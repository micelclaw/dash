import { commonMessages } from './messages';
import { activityMessages } from '@/modules/activity/i18n';
import { bookmarksMessages } from '@/modules/bookmarks/i18n';
import { calendarMessages } from '@/modules/calendar/i18n';
import { contactsMessages } from '@/modules/contacts/i18n';
import { diaryMessages } from '@/modules/diary/i18n';
import { digestMessages } from '@/modules/digest/i18n';
import { searchMessages } from '@/modules/search/i18n';
import { settingsMessages } from '@/components/settings/i18n';
import { automationSectionMessages } from '@/components/settings/sections/automation-i18n';
import { myApiKeysMessages } from '@/components/settings/sections/my-api-keys-i18n';
import { relatedItemsMessages } from '@/components/shared/related-items-i18n';
import { chatMessages } from '@/modules/chat/i18n';
import { portainerMessages } from '@/modules/portainer/i18n';
import { processesMessages } from '@/modules/processes/i18n';
import { serviceWakeMessages } from '@/modules/service-wake/i18n';
import { terminalMessages } from '@/modules/terminal/i18n';
import { dnsMessages } from '@/modules/dns/i18n';
import { proxyMessages } from '@/modules/proxy/i18n';
import { vpnMessages } from '@/modules/vpn/i18n';
import { toolsMessages } from '@/modules/tools/i18n';
import { calculatorMessages } from '@/modules/tools/calculator/i18n';
import { converterMessages } from '@/modules/tools/converter/i18n';
import { voiceRecorderMessages } from '@/modules/tools/voice-recorder/i18n';
import { pomodoroMessages } from '@/modules/tools/pomodoro/i18n';
import { financeMessages } from '@/modules/finance/i18n';
import { inventoryMessages } from '@/modules/inventory/i18n';
import { cryptoMessages } from '@/modules/crypto/i18n';
import { moduleMessages } from './module-messages';
import { shellMessages } from '@/components/shell/i18n';
import { feedsMessages } from '@/modules/feeds/i18n';
import { musicMessages } from '@/modules/music/i18n';
import { videoMessages } from '@/modules/video/i18n';
import { multimediaMessages } from '@/modules/multimedia/i18n';
import { sketchesMessages } from '@/modules/sketches/i18n';
import { sketchesShortcutsMessages } from '@/modules/sketches/shortcuts-i18n';
import { sketchesPagesMessages } from '@/modules/sketches/pages-i18n';
import { sketchesFloatingToolbarMessages } from '@/modules/sketches/floating-toolbar-i18n';
import { sketchesZoomMessages } from '@/modules/sketches/zoom-i18n';
import { sketchesLayersMessages } from '@/modules/sketches/layers-i18n';
import { sketchesSelectionStatsMessages } from '@/modules/sketches/selection-stats-i18n';
import { sketchesColorPickerMessages } from '@/modules/sketches/color-picker-i18n';
import { sketchesTextFormatMessages } from '@/modules/sketches/text-format-i18n';
import { sketchesIconPickerMessages } from '@/modules/sketches/icon-picker-i18n';
import { sketchesRowEditorsMessages } from '@/modules/sketches/row-editors-i18n';
import { sketchesPaneContextMenuMessages } from '@/modules/sketches/pane-context-menu-i18n';
import { sketchesNodeContextMenuMessages } from '@/modules/sketches/node-context-menu-i18n';
import { sketchesConnectionContextMenuMessages } from '@/modules/sketches/connection-context-menu-i18n';
import { sketchesCommandPaletteMessages } from '@/modules/sketches/command-palette-i18n';
import { sketchesMobilePropertiesMessages } from '@/modules/sketches/mobile-properties-i18n';
import { sketchesLauncherMessages } from '@/modules/sketches/launcher-i18n';
import { sketchesSegmentedMessages } from '@/modules/sketches/segmented-i18n';
import { sketchesPropertiesMessages } from '@/modules/sketches/properties-i18n';
import { sketchesDiagramEditorMessages } from '@/modules/sketches/diagram-editor-i18n';
import { sketchesWhiteboardMessages } from '@/modules/sketches/whiteboard-i18n';
import { sketchesDiagramToolbarMessages } from '@/modules/sketches/diagram-toolbar-i18n';
import { sketchesInlineEditorMessages } from '@/modules/sketches/inline-editor-i18n';
import { sketchesEmbedMessages } from '@/modules/sketches/shapes/embed-i18n';
import { sketchesTableShapeMessages } from '@/modules/sketches/shapes/table-i18n';
import { chatSaveResultsMessages } from '@/modules/chat/save-results-i18n';
import { chatBrowserStatusMessages } from '@/modules/chat/browser-status-i18n';
import { chatBrowserActionLogMessages } from '@/modules/chat/browser-action-log-i18n';
import { projectsShortcutsOverlayMessages } from '@/modules/projects/shortcuts-overlay-i18n';
import { projectsNewColumnInputMessages } from '@/modules/projects/new-column-input-i18n';
import { projectsCardFiltersMessages } from '@/modules/projects/card-filters-i18n';
import { projectsColumnHeaderMessages } from '@/modules/projects/column-header-i18n';
import { projectsPriorityBadgeMessages } from '@/modules/projects/priority-badge-i18n';
import { projectsBoardHeaderMessages } from '@/modules/projects/board-header-i18n';
import { projectsInboxZoneMessages } from '@/modules/projects/components/inbox-zone-i18n';
import { projectsCustomFieldManagerMessages } from '@/modules/projects/custom-field-manager-i18n';
import { projectsTransferBoardMessages } from '@/modules/projects/transfer-board-i18n';
import { projectsKanbanCardMessages } from '@/modules/projects/kanban-card-i18n';
import { projectsLinkedCardsMessages } from '@/modules/projects/linked-cards-i18n';
import { projectsAutomationEditorMessages } from '@/modules/projects/automation-editor-i18n';
import { projectsCardDetailRelationsMessages } from '@/modules/projects/card-detail-relations-i18n';
import { projectsEntityLinkPickerMessages } from '@/modules/projects/entity-link-picker-i18n';
import { studioMessages } from '@/modules/studio/i18n';
import { mediaMessages } from '@/components/media/i18n';
import { booksMessages } from '@/modules/books/i18n';
import { mailMessages } from '@/modules/mail/i18n';
import { mailServerMessages } from '@/modules/mail-server/i18n';
import { projectsMessages } from '@/modules/projects/i18n';
import { floatingMessages } from '@/components/floating-panel/i18n';
import { oauthMessages } from '@/modules/oauth/i18n';
import { devMessages } from '@/modules/dev/i18n';
import { micelhubMessages } from '@/modules/micelhub/i18n';
import { sharedMessages } from '@/components/shared/i18n';
import { messagesMessages } from '@/modules/messages/i18n';
import { approvalsMessages } from '@/modules/approvals/i18n';
import { agentsMessages } from '@/modules/agents/i18n';
import { agentsSkillsMessages } from '@/modules/agents/skills-i18n';
import { councilMessages } from '@/modules/agents/council/i18n';
import { dreamsDiaryMessages } from '@/modules/agents/dreams/diary-i18n';
import { driveQuotaMessages } from '@/modules/drive/quota-i18n';
import { driveTagsMessages } from '@/modules/drive/tags-i18n';
import { driveListMessages } from '@/modules/drive/list-i18n';
import { driveToolbarMessages } from '@/modules/drive/toolbar-i18n';
import { driveGridMessages } from '@/modules/drive/grid-i18n';
import { driveUploadQueueMessages } from '@/modules/drive/upload-queue-i18n';
import { driveTextPreviewMessages } from '@/modules/drive/text-preview-i18n';
import { driveLightboxMessages } from '@/modules/drive/lightbox-i18n';
import { drivePickerMessages } from '@/modules/drive/picker-i18n';
import { driveTrashMessages } from '@/modules/drive/trash-i18n';
import { driveNetworkFoldersMessages } from '@/modules/drive/network-folders-i18n';
import { driveVersioningSectionMessages } from '@/modules/drive/versioning-section-i18n';
import { driveSnapshotSettingsMessages } from '@/modules/drive/snapshot-settings-i18n';
import { driveConnectedClientsMessages } from '@/modules/drive/connected-clients-i18n';
import { driveVersionsTabMessages } from '@/modules/drive/versions-tab-i18n';
import { driveSettingsModalMessages } from '@/modules/drive/drive-settings-modal-i18n';
import { recurrenceBadgeMessages } from '@/modules/finance/personal/recurrence-badge-i18n';
import { diagnosticsBannerMessages } from '@/modules/agents/workboard/diagnostics-banner-i18n';
import { workboardStatsPillsMessages } from '@/modules/agents/workboard/stats-pills-i18n';
import { driveInspectorMessages } from '@/modules/drive/inspector-i18n';
import { shareMessages } from '@/modules/share/i18n';
import { storageMessages } from '@/modules/storage/i18n';
import { explorerMessages } from '@/modules/explorer/i18n';
import { photosMessages } from '@/modules/photos/i18n';
import { officeMessages } from '@/modules/office/i18n';
import { notesMessages } from '@/modules/notes/i18n';
import { gatewayMessages } from '@/modules/gateway/i18n';

export type Locale = 'en' | 'es';
export type Messages = { en: Record<string, string>; es: Record<string, string> };
export type MessageValues = Record<string, string | number>;

// Only acknowledged settings determine the displayed language. A draft must not
// change the entire interface until it has been saved successfully.
export function normalizeLocale(value: unknown): Locale {
  return typeof value === 'string' && value.toLowerCase().split(/[-_]/)[0] === 'es' ? 'es' : 'en';
}

export function selectLocale(authenticated: boolean, session: string, owner: string | null, confirmedLanguage: unknown): Locale {
  return normalizeLocale(authenticated && owner === session ? confirmedLanguage : undefined);
}

const catalogs: Messages[] = [commonMessages, moduleMessages, shellMessages, mediaMessages, floatingMessages, sharedMessages, relatedItemsMessages, activityMessages, bookmarksMessages, calendarMessages, contactsMessages, diaryMessages, digestMessages, searchMessages, settingsMessages, automationSectionMessages, myApiKeysMessages, chatMessages, chatSaveResultsMessages, chatBrowserStatusMessages, chatBrowserActionLogMessages, portainerMessages, processesMessages, serviceWakeMessages, terminalMessages, dnsMessages, proxyMessages, vpnMessages, toolsMessages, calculatorMessages, converterMessages, voiceRecorderMessages, pomodoroMessages, financeMessages, recurrenceBadgeMessages, inventoryMessages, cryptoMessages, feedsMessages, musicMessages, videoMessages, multimediaMessages, sketchesMessages, sketchesShortcutsMessages, sketchesPagesMessages, sketchesFloatingToolbarMessages, sketchesZoomMessages, sketchesLayersMessages, sketchesSelectionStatsMessages, sketchesColorPickerMessages, sketchesTextFormatMessages, sketchesIconPickerMessages, sketchesRowEditorsMessages, sketchesPaneContextMenuMessages, sketchesNodeContextMenuMessages, sketchesConnectionContextMenuMessages, sketchesCommandPaletteMessages, sketchesMobilePropertiesMessages, sketchesLauncherMessages, sketchesSegmentedMessages, sketchesPropertiesMessages, sketchesDiagramEditorMessages, sketchesWhiteboardMessages, sketchesDiagramToolbarMessages, sketchesInlineEditorMessages, sketchesEmbedMessages, sketchesTableShapeMessages, studioMessages, booksMessages, mailMessages, mailServerMessages, projectsMessages, projectsShortcutsOverlayMessages, projectsNewColumnInputMessages, projectsCardFiltersMessages, projectsColumnHeaderMessages, projectsPriorityBadgeMessages, projectsBoardHeaderMessages, projectsInboxZoneMessages, projectsCustomFieldManagerMessages, projectsTransferBoardMessages, projectsKanbanCardMessages, projectsLinkedCardsMessages, projectsAutomationEditorMessages, projectsCardDetailRelationsMessages, projectsEntityLinkPickerMessages, oauthMessages, devMessages, micelhubMessages, messagesMessages, approvalsMessages, agentsMessages, diagnosticsBannerMessages, workboardStatsPillsMessages, agentsSkillsMessages, councilMessages, dreamsDiaryMessages, driveQuotaMessages, driveTagsMessages, driveListMessages, driveToolbarMessages, driveGridMessages, driveUploadQueueMessages, driveTextPreviewMessages, driveLightboxMessages, drivePickerMessages, driveTrashMessages, driveNetworkFoldersMessages, driveVersioningSectionMessages, driveSnapshotSettingsMessages, driveConnectedClientsMessages, driveVersionsTabMessages, driveSettingsModalMessages, driveInspectorMessages, shareMessages, storageMessages, explorerMessages, photosMessages, notesMessages, gatewayMessages, officeMessages];

export const hasMessage = (key: string): boolean => catalogs.some((entry) => Object.prototype.hasOwnProperty.call(entry.en, key) && Object.prototype.hasOwnProperty.call(entry.es, key));

/** Check both coverage and interpolation without relying on fallback text. */
export function validateCatalogs(entries: Messages[] = catalogs): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const placeholders = (value: string) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort().join(',');
  for (const entry of entries) {
    const keys = new Set([...Object.keys(entry.en), ...Object.keys(entry.es)]);
    for (const key of keys) {
      if (seen.has(key)) problems.push(`Duplicate message: ${key}`);
      seen.add(key);
      const en = entry.en[key]; const es = entry.es[key];
      if (!en || !es) problems.push(`Missing message: ${key}`);
      else {
        // This translator supports only simple {name} substitution, not ICU expressions.
        if (/\{\s*\w+\s*,\s*(?:plural|select|selectordinal)\s*,/.test(en) || /\{\s*\w+\s*,\s*(?:plural|select|selectordinal)\s*,/.test(es)) problems.push(`Unsupported ICU expression: ${key}`);
        if (placeholders(en) !== placeholders(es)) problems.push(`Different placeholders: ${key}`);
      }
    }
  }
  return problems;
}

export function translate(locale: Locale, key: string, values: MessageValues = {}): string {
  const catalog = catalogs.find((entry) => Object.prototype.hasOwnProperty.call(entry.en, key));
  const template = catalog?.[locale][key] ?? catalog?.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

