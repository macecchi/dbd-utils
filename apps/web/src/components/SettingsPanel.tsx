import { useTranslation } from '../i18n';
import { Panel, PanelHeader } from './Panel';
import { SourcesSection } from './settings/SourcesSection';
import { OrderSection } from './settings/OrderSection';
import { BehaviorSection } from './settings/BehaviorSection';
import { ActionsSection } from './settings/ActionsSection';

interface SettingsPanelProps {
  onRecover?: () => void;
  onReview?: () => void;
}

export function SettingsPanel({ onRecover, onReview }: SettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <Panel className="settings-panel" id="settingsPanel">
      <PanelHeader
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        }
      >
        {t('settings.title')}
      </PanelHeader>

      <div className="settings-panel-body">
        <SourcesSection />
        <OrderSection />
        <BehaviorSection />
        <ActionsSection onReview={onReview} onRecover={onRecover} />
      </div>
    </Panel>
  );
}
