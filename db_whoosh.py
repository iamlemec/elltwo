#!/usr/bin/env python
# -*- coding: utf-8 -*-

# **************************************************************************
# Copyright © 2017-2020 jianglin
# Author: jianglin
# Email: mail@honmaple.com
# **************************************************************************

# **************************************************************************
# BSD 3-Clause License
#
# Copyright (c) 2017-2020, honmaple
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
# * Redistributions of source code must retain the above copyright notice, this
#   list of conditions and the following disclaimer.
#
# * Redistributions in binary form must reproduce the above copyright notice,
#   this list of conditions and the following disclaimer in the documentation
#   and/or other materials provided with the distribution.
#
# * Neither the name of the copyright holder nor the names of its
#   contributors may be used to endorse or promote products derived from
#   this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
# FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
# DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
# SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
# CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
# OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
# OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
# **************************************************************************

import os

import sqlalchemy
from sqlalchemy import types, event
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.inspection import inspect

from whoosh import index as whoosh_index
from whoosh.analysis import StemmingAnalyzer
from whoosh.fields import BOOLEAN, DATETIME, ID, NUMERIC, TEXT
from whoosh.fields import Schema as _Schema
from whoosh.qparser import AndGroup, MultifieldParser, OrGroup

default_analyzer = StemmingAnalyzer()

def get_mapper(query):
    if hasattr(query, "_mapper_zero"):
        return query._mapper_zero()
    return query._only_full_mapper_zero("get")

def relation_column(instance, fields):
    relation = getattr(instance.__class__, fields[0]).property
    _field = getattr(instance, fields[0])
    if relation.lazy == 'dynamic':
        _field = _field.first()
    return getattr(_field, fields[1]) if _field else ''

def default_signal(backend, sender, changes):
    for change in changes:
        instance = change[0]
        operation = change[1]
        if hasattr(instance, '__searchable__'):
            if operation == 'insert':
                backend.modify_index(instance)
            elif operation == 'update':
                backend.modify_index(instance, update=True)
            elif operation == 'delete':
                backend.modify_index(instance, delete=True)

        delete = True if operation == 'delete' else False
        prepare = [i for i in dir(instance) if i.startswith('msearch_')]
        for p in prepare:
            attrs = getattr(instance, p)(delete=delete)
            ix = backend.index(attrs.pop('_index'))
            if attrs['attrs']:
                for attr in attrs['attrs']:
                    ix.update(**backend._fields(ix, attr))
                ix.commit()

class Schema():
    def __init__(self, index):
        self.index = index
        self.pk = index.pk
        self.analyzer = index.analyzer
        self.schema = _Schema(**self.fields)

    def _fields(self):
        return {self.pk: ID(stored=True, unique=True)}

    def fields_map(self, field_type):
        if field_type == "primary":
            return ID(stored=True, unique=True)
        type_map = {
            'date': types.Date,
            'datetime': types.DateTime,
            'boolean': types.Boolean,
            'integer': types.Integer,
            'float': types.Float
        }
        if isinstance(field_type, str):
            field_type = type_map.get(field_type, types.Text)

        if not isinstance(field_type, type):
            field_type = field_type.__class__

        if issubclass(field_type, (types.DateTime, types.Date)):
            return DATETIME(stored=True, sortable=True)
        elif issubclass(field_type, types.Integer):
            return NUMERIC(stored=True, numtype=int)
        elif issubclass(field_type, types.Float):
            return NUMERIC(stored=True, numtype=float)
        elif issubclass(field_type, types.Boolean):
            return BOOLEAN(stored=True)
        return TEXT(stored=True, analyzer=self.analyzer, sortable=False)

    @property
    def fields(self):
        model = self.index.model
        schema_fields = self._fields()
        primary_keys = [key.name for key in inspect(model).primary_key]

        schema = getattr(model, "__msearch_schema__", dict())
        for field in self.index.searchable:
            if '.' in field:
                fields = field.split('.')
                field_attr = getattr(
                    getattr(model, fields[0]).property.mapper.class_, fields[1])
            else:
                field_attr = getattr(model, field)

            if field in schema:
                field_type = schema[field]
                if isinstance(field_type, str):
                    schema_fields[field] = self.fields_map(field_type)
                else:
                    schema_fields[field] = field_type
                continue

            if hasattr(field_attr, 'descriptor') and isinstance(
                    field_attr.descriptor, hybrid_property):
                schema_fields[field] = self.fields_map("text")
                continue

            if field in primary_keys:
                schema_fields[field] = self.fields_map("primary")
                continue

            field_type = field_attr.property.columns[0].type
            schema_fields[field] = self.fields_map(field_type)
        return schema_fields

class Index():
    def __init__(self, model, name, analyzer, path):
        self.model = model
        self.path = path
        self.name = getattr(model, "__msearch_index__", name)
        self.pk = getattr(model, "__msearch_primary_key__", 'id')
        self.analyzer = getattr(model, "__msearch_analyzer__", analyzer)
        self.searchable = set(getattr(model, "__searchable__", []))
        self._schema = Schema(self)
        self._writer = None
        self._client = self.init()

    def init(self):
        ix_path = os.path.join(self.path, self.name)
        if whoosh_index.exists_in(ix_path):
            return whoosh_index.open_dir(ix_path)
        if not os.path.exists(ix_path):
            os.makedirs(ix_path)
        return whoosh_index.create_in(ix_path, self.schema)

    @property
    def index(self):
        return self

    @property
    def fields(self):
        return self.schema.names()

    @property
    def schema(self):
        return self._schema.schema

    def create(self, *args, **kwargs):
        if self._writer is None:
            self._writer = self._client.writer()
        return self._writer.add_document(**kwargs)

    def update(self, *args, **kwargs):
        if self._writer is None:
            self._writer = self._client.writer()
        return self._writer.update_document(**kwargs)

    def delete(self, *args, **kwargs):
        if self._writer is None:
            self._writer = self._client.writer()
        return self._writer.delete_by_term(**kwargs)

    def commit(self):
        if self._writer is None:
            self._writer = self._client.writer()
        r = self._writer.commit()
        self._writer = None
        return r

    def search(self, *args, **kwargs):
        return self._client.searcher().search(*args, **kwargs)

class WhooshSearch():
    def __init__(self, analyzer=default_analyzer, path='msearch'):
        self._signal = None
        self._indexs = dict()
        self.analyzer = analyzer
        self.path = path

    def signal_connect(self, session, signal=default_signal):
        self._signal = signal

        if not hasattr(session, "_model_changes"):
            session._model_changes = {}
        event.listen(session, "before_flush", self.record_ops)
        event.listen(session, "before_commit", self.record_ops)
        event.listen(session, 'before_commit', self.index_signal)
        event.listen(session, 'after_commit', self.index_signal)
        event.listen(session, "after_rollback", self.after_rollback)

    def record_ops(self, session, flush_context=None, instances=None):
        try:
            d = session._model_changes
        except AttributeError:
            return

        for targets, operation in (
            (session.new, "insert"),
            (session.dirty, "update"),
            (session.deleted, "delete"),
        ):
            for target in targets:
                state = inspect(target)
                key = state.identity_key if state.has_identity else id(target)
                d[key] = (target, operation)

    def after_rollback(self, session):
        try:
            d = session._model_changes
        except AttributeError:
            return

        d.clear()

    def index_signal(self, session):
        try:
            d = session._model_changes
        except AttributeError:
            return
        return self._signal(self, session, list(d.values()))

    def index(self, model):
        name = model.__table__.name
        if name not in self._indexs:
            self._indexs[name] = Index(model, name, self.analyzer, self.path)
        return self._indexs[name]

    def modify_index(self, instance, update=False, delete=False, commit=True):
        if update and delete:
            raise ValueError("update and delete can't work togther")

        ix = self.index(instance.__class__)
        pk = ix.pk
        attrs = {pk: str(getattr(instance, pk))}

        for field in ix.fields:
            if '.' in field:
                attrs[field] = str(relation_column(instance, field.split('.')))
            else:
                attrs[field] = str(getattr(instance, field))
        if delete:
            ix.delete(fieldname=pk, text=str(getattr(instance, pk)))
        elif update:
            ix.update(**attrs)
        else:
            ix.create(**attrs)
        if commit:
            ix.commit()
        return instance

    def create_index(self, session, model, update=False, delete=False, yield_per=100):
        ix = self.index(model)
        instances = session.query(model).enable_eagerloads(False).yield_per(yield_per)
        for instance in instances:
            self.modify_index(instance, update, delete, False)
        ix.commit()
        return ix

    def _fields(self, index, attr):
        return attr

    def msearch(self, model, query, fields=None, limit=None, or_=True, **kwargs):
        ix = self.index(model)
        if fields is None:
            fields = ix.fields

        def _parser(fieldnames, schema, group, **kwargs):
            return MultifieldParser(fieldnames, schema, group=group, **kwargs)

        group = OrGroup if or_ else AndGroup
        parser = getattr(model, "__msearch_parser__", _parser)
        parsing = parser(fields, ix.schema, group, **kwargs)
        return ix.search(parsing.parse(query), limit=limit)

    def query_class(self, q):
        _self = self

        class Query(q):
            def msearch(self, query, fields=None, limit=None, or_=False, rank_order=False, **kwargs):
                model = get_mapper(self).class_
                ix = _self.index(model)
                results = _self.msearch(model, query, fields, limit, or_, **kwargs)
                if not results:
                    return self.filter(False)
                result_set = set()
                for i in results:
                    result_set.add(i[ix.pk])
                result_query = self.filter(
                    getattr(model, ix.pk).in_(result_set))
                if rank_order:
                    result_query = result_query.order_by(
                        sqlalchemy.sql.expression.case(
                            {r[ix.pk]: r.rank for r in results},
                            value=getattr(model, ix.pk)
                        )
                    )
                return result_query

        return Query
