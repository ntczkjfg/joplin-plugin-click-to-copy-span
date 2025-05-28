module.exports =  {
    default: function(context) {
        const pluginId = context.pluginId;
        return {
            plugin: async function(markdownIt, options) {
                const startToken = options.settingValue('startToken'),
                      endToken = options.settingValue('endToken');
                markdownIt.inline.ruler.before('emphasis',
                                              'clickToCopy',
                                              function(state, silent) {
                                                  return clickToCopy(state, silent, startToken, endToken, pluginId);
                                              });
            },
            assets: () => {
                return [ { name: './style.css' } ];
            },
        };
    }
};

// Tokenizing the click-to-copy fields
function clickToCopy(state, silent, startToken, endToken, pluginId) {
    // Doesn't start with startToken
    if (!state.src.slice(state.pos).startsWith(startToken)) return false;
    let startPos = state.pos + state.src.slice(state.pos, state.posMax).indexOf(startToken);
    let endPos = state.src.slice(startPos + startToken.length, state.posMax).indexOf(endToken);
    // Doesn't contain endToken
    if (endPos < 1) return false;
    endPos = startPos + startToken.length + endPos;
    // The content between startToken and endToken
    let content = state.src.slice(startPos + startToken.length, endPos);
    if (content.includes('\n')) return false;
    if (silent) {
        state.pos = endPos + endToken.length;
        return true;
    }
    // Open the span
    let token = state.push('span_open', 'span', 1);
    token.attrs = [[ 'class', 'ctc' ], [ 'onclick',   `let content = ${JSON.stringify(content)};
                                                       if (content.startsWith('\`') && content.endsWith('\`') && content.length > 1) {
                                                           // Inline code block - take off the backticks from the copy-text
                                                           content = content.slice(1, -1);
                                                       }
                                                       webviewApi.postMessage('${pluginId}', content)`
                                       ]
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
    token.content = content;
    token.children = [];
    state.md.renderer.render(token, state.options);

    // Close the span
    state.push('span_close', 'span', -1);

    // Set state.pos to just after endToken
    state.pos = endPos + endToken.length;
    return true;
}