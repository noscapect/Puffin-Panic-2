// The original crossing was replaced by the classic campaign's builder tutorial.
export async function play() {
    const campaign = await import('./replay-classic.mjs');
    return campaign.play(7);
}
