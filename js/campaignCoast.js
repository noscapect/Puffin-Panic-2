// Campaign slots describe future art direction. Only manifest entries are playable.
const CampaignCoast = (() => {
    const visits = [
        [13, 'puffin'], [18, 'harbour'], [22, 'flowers'],
        [26, 'basalt'], [29, 'puffin'], [33, 'cape'],
        [37, 'harbour'], [41, 'flowers'], [44, 'basalt'],
        [48, 'cape'], [51, 'harbour'], [55, 'puffin'],
        [59, 'flowers'], [63, 'basalt'], [66, 'cape'],
        [70, 'harbour'], [73, 'cape'], [77, 'flowers'],
        [81, 'basalt'], [84, 'harbour'], [88, 'cape'],
        [91, 'flowers'], [94, 'basalt'], [96, 'cape'], [99, 'puffin']
    ];
    function slot(number) {
        if (!Number.isInteger(number) || number < 1 || number > 99) return null;
        return { chapter: Math.ceil(number / 11), coast: visits.find(([end]) => number <= end)[1] };
    }
    return { slot };
})();

// Pixel silhouettes sit behind the playable terrain, in world coordinates.
const CoastStyles = {
    harbour: {
        sky: ['#92bcc7', '#f7d8ad', '#a2c3bd'], sea: ['#84b8bf', '#5599a3', '#467c90'],
        stone: [144, 100, 70], rim: [188, 148, 96],
        texture(x, y) {
            const plank = Math.floor(y / 6);
            if (y % 6 < 1 || (x + plank * 19) % 47 < 1) return -28;
            return 4 * Math.sin(x / 4 + plank);
        },
        horizon(rect) {
            rect(24, 98, 96, 3, '#847963');
            for (let x = 26; x < 120; x += 14) rect(x, 101, 2, 9, '#7c8274');
            for (const x of [32, 58, 84]) {
                rect(x, 86, 21, 12, '#aa7770');
                for (let i = 0; i < 5; i++) rect(x - 2 + i, 85 - i, 25 - 2*i, 1, '#717c7c');
                rect(x + 4, 90, 4, 5, '#e4cfaa');
                rect(x + 13, 90, 5, 8, '#786d63');
            }
        }
    },
    basalt: {
        sky: ['#849da9', '#d3daca', '#8faeb0'], sea: ['#9ab6b6', '#71959d', '#526e82'],
        stone: [74, 82, 93], rim: [151, 140, 94],
        texture(x, y) {
            const face = (x + Math.floor(y / 23) * 2) % 13;
            return face < 1 ? -28 : face < 6 ? 8 : -6;
        },
        horizon(rect) {
            for (let i = 0; i < 16; i++) {
                const top = 99 - Math.round(18 * Math.sin(i * .21) + 4 * Math.sin(i * 1.7));
                rect(235 + i*7, top, 7, 108-top, '#788e95');
                rect(235 + i*7, top, 3, 108-top, '#91a4a4');
            }
        }
    },
    flowers: {
        sky: ['#83cfe1', '#fff0d3', '#a9ded2'], sea: ['#a7d7cc', '#74bab5', '#539ba7'],
        stone: [154, 119, 84], rim: [104, 166, 76],
        texture(x, y) { return 4 * Math.sin(x / 6 + y / 4); },
        horizon(rect) {
            for (const [x, width] of [[19, 67], [116, 40], [261, 80]]) {
                for (let i = 0; i < width; i += 2) {
                    const top = 105 - Math.round(8 * Math.sin(Math.PI*i/width));
                    rect(x+i, top, 2, 107-top, '#88aa86');
                    if (i % 8 === 0) rect(x+i, top-1, 2, 1, '#d7a7ac');
                }
            }
        }
    },
    cape: {
        sky: ['#465780', '#cea4a0', '#8795ae'], sea: ['#9099ad', '#687f98', '#475b7b'],
        stone: [118, 108, 107], rim: [133, 140, 95],
        texture(x, y) { return (x + Math.floor(y / 9)*11) % 25 < 1 ? -13 : 0; },
        horizon(rect, ctx, ticks) {
            const x = 303;
            rect(x-8, 91, 22, 12, '#827e88');
            rect(x, 62, 7, 31, '#dfc4ae');
            rect(x, 69, 7, 6, '#ae7374');
            rect(x, 81, 7, 5, '#ae7374');
            rect(x-1, 61, 9, 2, '#575b73');
            rect(x, 57, 7, 4, '#ffe9ac');
            rect(x-1, 55, 9, 2, '#665c70');
            const reach = Math.cos(ticks / 160) * 77;
            ctx.fillStyle = 'rgba(255,225,158,.18)';
            ctx.beginPath();
            ctx.moveTo(x+3, 59);
            ctx.lineTo(x+3+reach, 54);
            ctx.lineTo(x+3+reach, 64);
            ctx.fill();
        }
    }
};
