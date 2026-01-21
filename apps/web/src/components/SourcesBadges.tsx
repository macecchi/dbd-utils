import { useChannel } from '../store';

export function SourcesBadges() {
    const { useSources } = useChannel();
    const serverIrcConnected = useSources((s) => s.serverIrcConnected);
    const sourcesEnabled = useSources((s) => s.enabled);
    const minDonation = useSources((s) => s.minDonation);
    const chatCommand = useSources((s) => s.chatCommand);
    const chatTiers = useSources((s) => s.chatTiers);

    const badges = (() => {
        if (!serverIrcConnected) return ['Pedidos desativados'];
        const parts: string[] = [];
        if (sourcesEnabled.donation) parts.push(`Donates (R$${minDonation}+)`);
        if (sourcesEnabled.chat) {
            const minTier = chatTiers.length ? Math.min(...chatTiers) : 1;
            parts.push(`${chatCommand} (tier ${minTier}+)`);
        }
        if (sourcesEnabled.resub) parts.push('Resubs');
        return parts.length ? parts : ['Pedidos desativados'];
    })();

    return (
        <>
            {badges.map((badge, i) => (
                <span key={i} className="sources-summary">{badge}</span>
            ))}
        </>
    );
}
