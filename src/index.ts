import joplin from 'api';
import { ContentScriptType, ToolbarButtonLocation } from 'api/types';

joplin.plugins.register({
	onStart: async function() {
		// Create the settings page
		await joplin.settings.registerSection('clickToCopySpans', {
		    label: 'Click-to-Copy spans',
		    iconName: 'fas fa-copy',
		});
		await joplin.settings.registerSettings({
			showInEditor: {
		        value: true,
		        type: 3, // Boolean
		        section: 'clickToCopySpans',
		        public: true,
		        label: 'Render in the Editor view also',
		    },
		    startToken: {
		        value: '[[', // Default start token
		        type: 2, // String
		        section: 'clickToCopySpans',
		        public: true,
		        label: 'Start Token',
		    },
		    endToken: {
		        value: ']]', // Default end token
		        type: 2, // String
		        section: 'clickToCopySpans',
		        public: true,
		        label: 'End Token',
		    }
		});

		// Create a toolbar button
		await joplin.commands.register({
			name: 'insert_click_to_copy_span',
			label: 'Click-to-Copy Span',
			iconName: 'fas fa-copy',
			execute: async () => {
				const selectedText = (await joplin.commands.execute('selectedText') as string);
				let content = selectedText.split('\n');
				const startToken = await joplin.settings.value('startToken');
				const endToken = await joplin.settings.value('endToken');
				if (content.length == 1) {
					if (content[0] !== '') {
						await joplin.commands.execute('replaceSelection',`${startToken}${content[0]}${endToken}`);
					} else {
						await joplin.commands.execute('insertText',`${startToken}Insert text here${endToken}`);
					}
				}
			}
		});
		// Add it to the toolbar
		await joplin.views.toolbarButtons.create('insert_click_to_copy_span', 'insert_click_to_copy_span', ToolbarButtonLocation.EditorToolbar);

		// Register the editor plugin
		const editorScriptId = 'joplin-plugin-click-to-copy-span-editor';
        await joplin.contentScripts.register(
        	ContentScriptType.CodeMirrorPlugin,
        	editorScriptId,
        	'editorScript.js');
        // The editor script sends a message here to receive settings
		await joplin.contentScripts.onMessage(editorScriptId, async (message: { name: string, data: { [key: string]: any } }) => {
			switch (message.name) {
				case 'copyText':
					joplin.clipboard.writeText(message.data.text);
					break;
				case 'getSettings':
					const [showInEditor, startToken, endToken] = await Promise.all([
				        joplin.settings.value('showInEditor'),
				        joplin.settings.value('startToken'),
				        joplin.settings.value('endToken')
				    ]);
				    const settings = { showInEditor, startToken, endToken };
				    return settings;
					break;
				default:
					break;
			}
		});

		// Register the webview plugin
		const webviewScriptId = 'joplin-plugin-click-to-copy-span';
		await joplin.contentScripts.register(
			ContentScriptType.MarkdownItPlugin,
			webviewScriptId,
			'webviewScript.js');
		await joplin.contentScripts.onMessage(webviewScriptId, (message: string) => {
	    	joplin.clipboard.writeText(message);
	    });
	},
});