import joplin from 'api';
import { ContentScriptType, ToolbarButtonLocation, SettingItemType } from 'api/types';

joplin.plugins.register({
	onStart: async function() {
		// Create the settings page
		await joplin.settings.registerSection('clickToCopySpans', {
		    label: 'Click-to-Copy Spans',
		    description: 'Click-to-Copy Span Plugin Settings',
		    iconName: 'fas fa-copy',
		});
		await joplin.settings.registerSettings({
			showInEditor: {
		        section: 'clickToCopySpans',
		        public: true,
		        type: SettingItemType.Bool,
		        value: true,
		        label: 'Render in the Editor view also',
		    },
			hideMarkdown: {
				section: 'clickToCopySpans',
				public: true,
				type: SettingItemType.Bool,
				value: true,
				label: 'Hide start and end tokens when rendering spans in the editor view',
			},
		    startToken: {
		        section: 'clickToCopySpans',
		        public: true,
		        type: SettingItemType.String,
		        value: '[[', // Default start token
		        label: 'Start Token',
		    },
		    endToken: {
		        section: 'clickToCopySpans',
		        public: true,
		        type: SettingItemType.String,
		        value: ']]', // Default end token
		        label: 'End Token',
		    },
		    inlineCodeWebview: {
		    	section: 'clickToCopySpans',
		    	public: true,
		    	type: SettingItemType.Bool,
		    	value: 'false',
		    	label: 'Make ALL inline code click-to-copy in the Webview',
		    },
		    inlineCodeEditor: {
		    	section: 'clickToCopySpans',
		    	public: true,
		    	type: SettingItemType.Bool,
		    	value: 'false',
		    	label: 'Make ALL inline code click-to-copy in the Editor',
		    	description: 'Won\'t work on multiline inline code spans',
		    	// ↑ It could, and at one point in development it did
		    	// However, it was visually very confusing and so was removed
		    },
		    hideCodeDelimiters: {
		    	section: 'clickToCopySpans',
		    	public: true,
		    	type: SettingItemType.Bool,
		    	value: 'false',
		    	label: 'Hide delimiting backticks when making inline code click-to-copy in the editor',
		    	description: 'This option does nothing if the above option isn\'t also enabled',
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
			},
			enabledCondition: 'markdownEditorPaneVisible && !richTextEditorVisible'
		});
		// Add it to the toolbar
		await joplin.views.toolbarButtons.create('insert_click_to_copy_span', 'insert_click_to_copy_span', ToolbarButtonLocation.EditorToolbar);

		// Register the editor plugin
		const editorScriptId = 'com.joplin.click.to.copy.editor';
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
				case 'copyPassword':
					const password = message.data.text;
					joplin.clipboard.writeText(password);
					setTimeout(async () => {
						const currentClipboard = await joplin.clipboard.readText();
						if (currentClipboard === password) {
							await joplin.clipboard.writeText(' ');
						}
					}, 15000);
					break;
				case 'getSettings':
					const [showInEditor, hideMarkdown, startToken, endToken, inlineCodeEditor, hideCodeDelimiters] = await Promise.all([
				        joplin.settings.value('showInEditor'),
						joplin.settings.value('hideMarkdown'),
				        joplin.settings.value('startToken'),
				        joplin.settings.value('endToken'),
				        joplin.settings.value('inlineCodeEditor'),
				        joplin.settings.value('hideCodeDelimiters'),
				    ]);
				    const settings = { showInEditor, hideMarkdown, startToken, endToken, inlineCodeEditor, hideCodeDelimiters };
				    return settings;
					break;
				default:
					break;
			}
		});

		// Register the webview plugin
		const webviewScriptId = 'com.joplin.click.to.copy';
		await joplin.contentScripts.register(
			ContentScriptType.MarkdownItPlugin,
			webviewScriptId,
			'webviewScript.js');
		await joplin.contentScripts.onMessage(webviewScriptId, (message: { name: string, data: { [key: string]: any } }) => {
			switch (message.name) {
				case 'copyText':
					joplin.clipboard.writeText(message.data.text);
					break;
				case 'copyPassword':
					const password = message.data.text;
					joplin.clipboard.writeText(password);
					setTimeout(async () => {
						const currentClipboard = await joplin.clipboard.readText();
						if (currentClipboard === password) {
							await joplin.clipboard.writeText(' ');
						}
					}, 15000);
					break;
				default:
					break;
			}
	    });
	},
});
