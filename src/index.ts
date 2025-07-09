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
		        value: true,
		        type: SettingItemType.Bool,
		        section: 'clickToCopySpans',
		        public: true,
		        label: 'Render in the Editor view also'
		    },
			hideMarkdown: {
				value: true,
				type: SettingItemType.Bool,
				section: 'clickToCopySpans',
				public: true,
				label: 'Hide start and end tokens when rendering spans in the editor view'
			},
		    startToken: {
		        value: '[[', // Default start token
		        type: SettingItemType.String,
		        section: 'clickToCopySpans',
		        public: true,
		        label: 'Start Token'
		    },
		    endToken: {
		        value: ']]', // Default end token
		        type: SettingItemType.String,
		        section: 'clickToCopySpans',
		        public: true,
		        label: 'End Token'
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
					const [showInEditor, hideMarkdown, startToken, endToken] = await Promise.all([
				        joplin.settings.value('showInEditor'),
						joplin.settings.value('hideMarkdown'),
				        joplin.settings.value('startToken'),
				        joplin.settings.value('endToken')
				    ]);
				    const settings = { showInEditor, hideMarkdown, startToken, endToken };
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
