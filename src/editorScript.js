import { Decoration, WidgetType, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

export default (context) => {
    return {
        assets: () => [{ name: 'style.css' }],
        plugin: async (codeMirrorWrapper) => {
            const settings = await context.postMessage({ name: 'getSettings', data: {} });
            const { showInEditor, hideMarkdown, startToken, endToken, inlineCodeEditor, hideCodeDelimiters } = settings;
            const escapedStartToken = startToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const escapedEndToken = endToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const ctcRegex = new RegExp(`((?:${escapedStartToken}){1,2})(.+?)((?:${escapedEndToken}){1,2})`, 'g');

            // Defines a CodeMirror view plugin that updates decorations on relevant changes
            const ctcPlugin = ViewPlugin.fromClass(
                class {
                    constructor(view) {
                        try {
                            this.decorations = applyDecorations(view);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    update(update) {
                        if (update.docChanged || update.viewportChanged || update.selectionSet) {
                            try {
                                this.decorations = applyDecorations(update.view);
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }
                },
                {
                    decorations: v => v.decorations
                }
            );

            // Defines a CodeMirror view plugin that updates decorations on relevant changes
            const ctcCodePlugin = ViewPlugin.fromClass(
                class {
                    constructor(view) {
                        try {
                            this.decorations = applyDecorationsToCode(view);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    update(update) {
                        if (update.docChanged || update.viewportChanged || update.selectionSet) {
                            try {
                                this.decorations = applyDecorationsToCode(update.view);
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }
                },
                {
                    decorations: v => v.decorations
                }
            );

            // Searches for click-to-copy sections in the editor, and renders them as click-to-copy spans
            function applyDecorations(view) {
                const builder = new RangeSetBuilder();
                if (!showInEditor) {
                    return builder.finish();
                }
                // Get the line the cursor is currently on
                const selectedLine = view.state.doc.lineAt(view.state.selection.main.head).number;
                // for all ranges currently visible in editors
                for (const { from, to } of view.visibleRanges) {
                    const startLine = view.state.doc.lineAt(from).number;
                    const endLine = view.state.doc.lineAt(to).number;
                    // Search all lines in all visible ranges
                    for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
                        // Skip the line if the cursor is on it, so the user may still make edits
                        if (lineNo === selectedLine) continue;
                        const line = view.state.doc.line(lineNo); // line content
                        let match;
                        while (match = ctcRegex.exec(line.text)) {
                            if (startToken === '`' && endToken === '`' && match[2] === '') continue;
                            let start = line.from + match.index;
                            // match[0] = the entire matched string, not just a capture group
                            let end = start + match[0].length;
                            let isPassword = false;
                            let clearClipboard = false;
                            if (match[1].length === 2*startToken.length) {
                                isPassword = true;
                            }
                            if (match[3].length === 2*endToken.length) {
                                clearClipboard = true;
                            }
                            if (!hideMarkdown) {
                                // Doesn't hide the start and end token markdown, but does style them to be less obtrusive
                                let newStart = start + match[1].length;
                                let newEnd = end - match[3].length;
                                if (match[2].length > 1 && match[2].startsWith('`') && match[2].endsWith('`')) {
                                    newStart += 1;
                                    newEnd -= 1;
                                }
                                builder.add(
                                    start,
                                    newStart,
                                    Decoration.mark({ class: 'ctc-markdown' })
                                );
                                builder.add(
                                    newStart,
                                    newEnd,
                                    // Decoration.replace ensures the editor text is *replaced by* the new span
                                    Decoration.replace({
                                        // match[1] = the first (and only) capture group
                                        widget: new ClickToCopyWidget(match[2], isPassword, clearClipboard),
                                                       inclusive: false // Won't include adjacent text
                                    })
                                );
                                builder.add(
                                    newEnd,
                                    end,
                                    Decoration.mark({ class: 'ctc-markdown' })
                                );
                                start = newStart;
                                end = newEnd;
                            } else {
                                builder.add(
                                    start,
                                    end,
                                    // Decoration.replace ensures the editor text is *replaced by* the new span
                                    Decoration.replace({
                                        // match[1] = the first (and only) capture group
                                        widget: new ClickToCopyWidget(match[2], isPassword, clearClipboard),
                                    })
                                );
                            }
                        }
                    }
                }
                return builder.finish();
            }

            // Searches for inline code in the editor, and renders them as click-to-copy spans
            function applyDecorationsToCode(view) {
                const builder = new RangeSetBuilder();
                if (!showInEditor) {
                    return builder.finish();
                }
                let inBlock = false;
                let blockOpenerLength;
                // Get the line the cursor is currently on
                const selectedLine = view.state.doc.lineAt(view.state.selection.main.head).number;
                const reCodeBlock = /^(```+)[^`]*?$/m;
                const reCodeBlockEnd = /^```+$/m;
                const reLeft = /(?<!`)`+/g;
                // for all ranges currently visible in editors
                for (const { from, to } of view.visibleRanges) {
                    const doc = view.state.doc.toString().slice(from, to);
                    let matchLeft;
                    while (matchLeft = reLeft.exec(doc)) {
                        let match; // Used and re-used when detecting code blocks
                        // The current line containing our match
                        const currLine = view.state.doc.lineAt(from + matchLeft.index);
                        if (blockOpenerLength) { // We are in a code block - the only thing we can do is wait until it ends
                            if ((match = reCodeBlockEnd.exec(currLine.text)) && // Current line is just backticks
                                (match[0].length >= blockOpenerLength)) {  // And there are enough backticks to end the block!
                                blockOpenerLength = null;
                            }
                            continue;
                        }
                        // Check if this line begins a code block
                        if (match = reCodeBlock.exec(currLine.text)) {
                            // It does - note how long its opener is and continue
                            blockOpenerLength = match[1].length;
                            continue;
                        }
                        // RegEx to match exactly the same number of backticks as the opener
                        const reRight = new RegExp(`(?<!\`)${matchLeft[0]}(?!\`)`, 'g');
                        // Start the search after the opener
                        reRight.lastIndex = matchLeft.index + 1;
                        const matchRight = reRight.exec(doc)
                        if (!matchRight) continue; // This opener has no matching closer, move on

                        // Everything between the opener and closer
                        const content = doc.slice(matchLeft.index + matchLeft[0].length, matchRight.index);
                        // Does the content contain a valid code block starting line? If so, it is not a valid inline code span
                        if (reCodeBlock.test(content)) continue;

                        // At this point we definitely have a valid inline code block

                        // Is the cursor on this line? Then we don't want to decorate it
                        if (selectedLine === currLine.number) {
                            // Skip past the entire span
                            reLeft.lastIndex = matchRight.index + 1;
                            continue
                        }
                        // Does this span include linebreaks?
                        // It's valid, but visually confusing with click-to-copy spans - skip past it
                        if (content.includes('\n')) {
                            reLeft.lastIndex = matchRight.index + 1;
                            continue;
                        }
                        // The default webview rule modifies span content like this so we will too ¯\_(ツ)_/¯
                        // This is the text that will actually be copied
                        const copyContent = content.replace(/^ (.+) $/, '$1')
                        // start and end include the backticks, but the text that gets copied does not
                        // Looks nice and works how users would expect
                        const start = from + matchLeft.index;
                        const end = from + matchRight.index + matchRight[0].length;
                        const text = hideCodeDelimiters ? content : matchLeft[0] + content + matchRight[0];
                        builder.add(start, end,
                            Decoration.replace({
                                // Parameters: Span's text content, isPassword, clearClipboard, isCode, text to be copied
                                widget: new ClickToCopyWidget(text, false, false, true, copyContent),
                            })
                        );
                        reLeft.lastIndex = matchRight.index + 1;
                    }
                }
                return builder.finish();
            }

            // WidgetType that defines the click-to-copy span and its various attributes
            class ClickToCopyWidget extends WidgetType {
                constructor(text, isPassword, clearClipboard, isCode, copyText) {
                    super();
                    this.text = text;
                    this.isPassword = isPassword;
                    this.clearClipboard = clearClipboard;
                    this.isCode = isCode ?? false;
                    this.copyText = copyText ?? this.text
                    this.checkTextForCode();
                }
                // See if this text is meant to be styled as an inline code block
                checkTextForCode() {
                    if (this.isCode) return;
                    if (this.text.startsWith('`') && this.text.endsWith('`') && this.text.length > 1) {
                        // Text starts and ends with backticks - inline code!
                        this.isCode = true;
                        // Remove the backticks
                        this.text = this.text.slice(1, -1);
                    } else if (startToken === '`' && endToken === '`') {
                        // The start and end tokens are backticks - display as inline code, nothing to remove
                        this.isCode = true;
                    } else {
                        // Not inline code
                        this.isCode = false;
                    }
                }
                toDOM() {
                    // Make a span to encase the text
                    const span = document.createElement('span');
                    // Add appropriate classes depending on whether or not it's inline code
                    if (this.isCode) {
                        span.className = 'ctc cm-inlineCode'
                    } else {
                        span.className = 'ctc';
                    }
                    // these are applied to inline code by default, seemed a good fit in general though
                    span.spellcheck = false;
                    span.setAttribute('autocorrect', 'false');
                    // Add in the text
                    if (this.isPassword) {
                        span.textContent = '•'.repeat(this.text.length);
                    } else {
                        span.textContent = this.text;
                    }
                    // on click, send the text to index.ts, which will then copy it to the user's clipboard
                    const command = (this.clearClipboard) ? 'copyPassword' : 'copyText'
                    span.onclick = () => { context.postMessage({ name: `${command}`, data: { text: this.copyText } }); };
                    span.oncontextmenu = (e) => {
                        if (this.isPassword) {
                            if (span.textContent === this.text) {
                                span.textContent = '•'.repeat(this.text.length);
                            } else {
                                span.textContent = this.text;
                            }
                        }
                    };
                    return span;
                }
                ignoreEvent() {
                    // This ensures that when the span is clicked on, the cursor's position doesn't change
                    return true;
                }
            }

            // Add the extension
            codeMirrorWrapper.addExtension(ctcPlugin);
            if (inlineCodeEditor) codeMirrorWrapper.addExtension(ctcCodePlugin);
        }
    };
};
