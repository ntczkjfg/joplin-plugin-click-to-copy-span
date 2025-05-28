import { Decoration, WidgetType, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

export default (context) => {
    return {
        assets: () => [{ name: './style.css' }],
        plugin: async (codeMirrorWrapper) => {
            const settings = await context.postMessage({ name: 'getSettings', data: {} });
            const { showInEditor, startToken, endToken } = settings;
            const escapedStartToken = startToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const escapedEndToken = endToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const ctcRegex = new RegExp(`${escapedStartToken}(.*?)${escapedEndToken}`, 'g');

            // Defines a CodeMirror view plugin that updates decorations on relevant changes
            const ctcPlugin = ViewPlugin.fromClass(
                class {
                    constructor(view) {
                        this.decorations = applyDecorations(view);
                    }
                    update(update) {
                        if (update.docChanged || update.viewportChanged || update.selectionSet) {
                            this.decorations = applyDecorations(update.view);
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
                        while ((match = ctcRegex.exec(line.text)) !== null) {
                            const start = line.from + match.index;
                            // match[0] = the entire matched string, not just a capture group
                            const end = start + match[0].length;
                            builder.add(
                                start,
                                end,
                                // Decoration.replace ensures the editor text is *replaced by* the new span
                                Decoration.replace({
                                    // match[1] = the first (and only) capture group
                                    widget: new ClickToCopyWidget(match[1]),
                                    inclusive: false // Won't include adjacent text
                                })
                            );
                        }
                    }
                }
                return builder.finish();
            }

            // WidgetType that defines the click-to-copy span and its various attributes
            class ClickToCopyWidget extends WidgetType {
                constructor(text) {
                    super();
                    this.text = text;
                    this.checkTextForCode();
                }
                // See if this text is meant to be styled as an inline code block
                checkTextForCode() {
                    if (this.text.startsWith('`') && this.text.endsWith('`') && this.text.length > 1) {
                        // Text starts and ends with backticks - inline code!
                        this.isCode = true;
                        // Remove the backticks
                        this.text = this.text.slice(1, -1);
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
                    span.textContent = this.text;
                    // on click, send the text to index.ts, which will then copy it to the user's clipboard
                    span.onclick = () => { context.postMessage({ name: 'copyText', data: { text: this.text } }); };
                    return span;
                }
                ignoreEvent() {
                    // This ensures that when the span is clicked on, the cursor's position doesn't change
                    return true;
                }
            }

            // Add the extension
            codeMirrorWrapper.addExtension(ctcPlugin);
        }
    };
};