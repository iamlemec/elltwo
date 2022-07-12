from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from flask_login import UserMixin

OuterBase = declarative_base()

class Repo(OuterBase):
    __tablename__ = 'repo'

    rid = Column(Integer, primary_key=True)
    domain = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.aid} [{self.create_time} → {self.delete_time}]: {self.domain} ({self.name})'