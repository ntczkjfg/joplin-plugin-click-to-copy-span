module.exports =  {
    default: function(context) {
        const pluginId = context.pluginId;
        return {
            plugin: async function(markdownIt, options) {
                const startToken = options.settingValue('startToken'),
                      endToken = options.settingValue('endToken');
                markdownIt.inline.ruler.before('text',
                                              'clickToCopy',
                                              function(state, silent) {
                                                  return clickToCopy(state, silent, startToken, endToken, pluginId);
                                              });
                if (options.settingValue('inlineCodeWebview')) {
                    markdownIt.inline.ruler.before('backticks',
                                                   'inlineCode',
                                                   function(state, silent) {
                                                       return inlineCode(state, silent, pluginId);
                                                   });
                }
            },
            assets: () => {
                return [ { name: 'style.css' } ];
            },
        };
    }
};

function inlineCode(state, silent, pluginId) {
    let pos = state.pos
    const ch = state.src.charCodeAt(pos)

    if (ch !== 0x60/* ` */) { return false }

    const start = pos
    pos++
    const max = state.posMax

    // scan marker length
    while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++ }

    const marker = state.src.slice(start, pos)
    const openerLength = marker.length

    if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
        if (!silent) state.pending += marker
        state.pos += openerLength
        return true
    }

    let matchEnd = pos
    let matchStart

    // Nothing found in the cache, scan until the end of the line (or until marker is found)
    while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
        matchEnd = matchStart + 1

        // scan marker length
        while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++ }

        const closerLength = matchEnd - matchStart

        if (closerLength === openerLength) {
            // Found matching closer length.
            if (!silent) {
                const content = state.src.slice(pos, matchStart)
                    .replace(/\n/g, ' ')
                    .replace(/^ (.+) $/, '$1')
                const token = state.push('code_inline', 'code', 0)
                token.markup = marker
                token.content = content
                token.attrs = [['class', 'ctc'], ['onclick', `
            event.preventDefault();
            let content = ${JSON.stringify(content)};
            webviewApi.postMessage('${pluginId}', { name: 'copyText', data: { text: content } })
                `]]
            }
            state.pos = matchEnd
            return true
        }

        // Some different length found, put it in cache as upper limit of where closer can be found
        state.backticks[closerLength] = matchStart
    }

    // Scanned through the end, didn't find anything
    state.backticksScanned = true

    if (!silent) state.pending += marker
    state.pos += openerLength
    return true
}

// Tokenizing the click-to-copy spans
function clickToCopy(state, silent, startToken, endToken, pluginId) {
    if (startToken === undefined || endToken === undefined) return false;
    // Doesn't start with startToken
    if (!state.src.slice(state.pos).startsWith(startToken)) {
        // The following is a workaround to an issue where, if a startToken does NOT start with one of the following characters, then
        // the built-in 'text' rule will skip over the startToken, and never let this rule see it. This is essentially a modified
        // copy+paste of the 'text' rule. If it detects that a valid span might be skipped by it, it does what the text rule would to
        // the intervening characters, then resumes the rest of this rule
        const symbols = ['!', '#', '$', '%', '&', '*', '+', '-', ':', '<', '=', '>', '@', '[', '\\', ']', '^', '_', '`', '{', '}', '~'];
        if (!symbols.includes(startToken[0])) {
            const remainder = state.src.slice(state.pos, state.posMax);
            let firstIndex = state.posMax - state.pos;
            for (const char of symbols) {
                const index = remainder.indexOf(char);
                if (index !== -1 && (firstIndex === -1 || index < firstIndex)) firstIndex = index;
            }
            // newSlice is the text the 'text' rule would skip over - let's see if it has our startToken
            const newSlice = state.src.slice(state.pos, state.pos + firstIndex);
            if (newSlice.indexOf(startToken) !== -1) {
                // It does - process the stuff before it, then set state.pos to position for our rule, and continue
                const pos = state.pos + newSlice.indexOf(startToken);
                state.pending += state.src.slice(state.pos, pos);
                state.pos = pos;
            }
            else return false;
        } else return false;
    }
    const startPos = state.pos + state.src.slice(state.pos, state.posMax).indexOf(startToken);
    const isPassword = state.src.slice(startPos + startToken.length).startsWith(startToken); // startToken is doubled
    const numTokens = isPassword ? 2 : 1; // The number of startTokens
    const contentStart = startPos + numTokens * startToken.length;
    let endPos = state.src.slice(contentStart + 1, state.posMax).indexOf(endToken);
    if (endPos < 0) return false; // Doesn't contain endToken
    endPos = contentStart + 1 + endPos;
    // The content between startToken and endToken
    let content = state.src.slice(contentStart, endPos);
    let clearClipboard = false;
    if (state.src.slice(endPos + endToken.length, state.posMax).startsWith(endToken)) {
        clearClipboard = true;
        endPos += endToken.length;
    }
    if (content.includes('\n') || content.length === 0) return false;
    if (silent) {
        state.pos = endPos + endToken.length;
        return true;
    }
    // Open the span
    let token = state.push('span_open', 'span', 1);
    const command = (clearClipboard) ? 'copyPassword' : 'copyText';
    if (startToken === '`' && endToken === '`') content = '`' + content + '`';
    token.attrs = [
        [ 'class', 'ctc' ],
        [ 'onclick',   `
            // Prevents clicking the span from doing things like toggling the state of checklist items
            event.preventDefault();
            let content = ${JSON.stringify(content)};
            if (content.startsWith('\`') && content.endsWith('\`') && content.length > 1) {
                // Inline code block - take off the backticks from the copy-text
                content = content.slice(1, -1);
            }
            webviewApi.postMessage('${pluginId}', { name: '${command}', data: { text: content } })
        `],
        ['oncontextmenu', `
        if (${isPassword}) {
            let content = ${JSON.stringify(content)};
            if (content.startsWith('\`') && content.endsWith('\`') && content.length > 1) {
                // Inline code block - take off the backticks from the copy-text
                content = content.slice(1, -1);
            }
            const span = this;
            const code = span.querySelector('code');
            // Ensures we don't overwrite the <code> tag, if present
            const target = code || span;
            // Alternate between having the password be visible and obfuscated
            target.textContent = (target.textContent === content) ? '•'.repeat(content.length) : content;
        }
        `]
    ];

    // Fill it with content
    // See if it's inline code or not to decide token type
    if (content.length > 1 && content.startsWith('`') && content.endsWith('`')) {
        // This is inline code, display it as such
        token = state.push('code_inline', '', 0);
        // Remove the backticks
        content = content.slice(1, -1);
    } else {
        // Not inline code, treat it as plain text
        token = state.push('text', '', 0);
    }
    if (isPassword) {
        token.content = '•'.repeat(content.length);
    } else {
        token.content = content;
    }
    token.children = [];
    state.md.renderer.render(token, state.options);

    // Close the span
    state.push('span_close', 'span', -1);

    // Set state.pos to just after endToken
    state.pos = endPos + endToken.length;
    return true;
}
