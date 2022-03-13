// elltwo lezer parser

export { elltwo }

import { markdown } from "@codemirror/lang-markdown"
import { styleTags, tags } from "@codemirror/highlight"

const StrikethroughDelim = {resolve: "Strikethrough", mark: "StrikethroughMark"};
const InternalLinkDelim = {resolve: "InternalLink", mark: "InternalLinkMark"};
const ReflikeDelim = {resolve: "Reflike", mark: "ReflikeMark"};

const elltwo = markdown({
    extensions: {
        props: [
            styleTags({
                Strikethrough: tags.deleted,
                StrikethroughMark: tags.deleted,
                InternalLink: tags.keyword,
                InternalLinkMark: tags.keyword,
                ReflikeMark: tags.keyword,
            }),
        ],
        defineNodes: [
            "Strikethrough",
            "StrikethroughMark",
            "InternalLink",
            "InternalLinkMark",
            "Reflike",
            "ReflikeMark",
        ],
        parseInline: [
            {
                name: "Strikethrough",
                parse(cx, next, pos) {
                    if (next == 126 && cx.char(pos + 1) == 126) {
                        return cx.addDelimiter(StrikethroughDelim, pos, pos + 2, true, true);
                    }
                    return -1;
                },
                after: "Emphasis",
            },
            {
                name: "InternalLink",
                parse(cx, next, pos) {
                    if (next == 91 && cx.char(pos + 1) == 91) {
                        return cx.addDelimiter(InternalLinkDelim, pos, pos + 2, true, false);
                    }
                    if (next == 93 && cx.char(pos + 1) == 93) {
                        return cx.addDelimiter(InternalLinkDelim, pos, pos + 2, false, true);
                    }
                    return -1;
                },
                before: "Link",
            },
            {
                name: "Reflike",
                parse(cx, next, pos) {
                    if ((next == 94 || next == 64) && cx.char(pos + 1) == 91) {
                        return cx.addDelimiter(ReflikeDelim, pos, pos + 2, true, false);
                    }
                    return -1;
                },
                before: "Link",
            },
            {
                name: "ReflikeEnd",
                parse(cx, next, pos) {
                    if (next == 93) {
                        return cx.addDelimiter(ReflikeDelim, pos, pos + 1, false, true);
                    }
                    return -1;
                },
                after: "LinkEnd",
            },
        ],
    },
});
