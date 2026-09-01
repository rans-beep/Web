import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// DETEKSI PLATFORM
// ============================================
const detectPlatform = (url) => {
    const platforms = {
        'youtube': ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
        'tiktok': ['tiktok.com', 'vm.tiktok', 'vt.tiktok'],
        'instagram': ['instagram.com', 'instagr.am', 'ig.me'],
        'twitter': ['twitter.com', 'x.com'],
        'facebook': ['facebook.com', 'fb.com', 'fb.watch'],
        'pinterest': ['pinterest.com', 'pin.it'],
        'dailymotion': ['dailymotion.com', 'dai.ly'],
        'reddit': ['reddit.com', 'v.redd.it'],
        'twitch': ['twitch.tv'],
        'vimeo': ['vimeo.com'],
        'soundcloud': ['soundcloud.com'],
        'bilibili': ['bilibili.com', 'b23.tv']
    };
    for (const [platform, domains] of Object.entries(platforms)) {
        if (domains.some(d => url.includes(d))) return platform;
    }
    return 'unknown';
};

// ============================================
// ENDPOINT DOWNLOAD (Vevioz + Cobalt API)
// ============================================
app.post('/api/download', async (req, res) => {
    const { url } = req.body;

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ success: false, error: 'URL tidak valid!' });
    }

    const platform = detectPlatform(url);

    try {
        // ===== VEVIOZ API (utama) =====
        const response = await fetch(`https://api.vevioz.com/api/button/mp4/${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data && data.url) {
            const title = data.title || 'Video';
            const filename = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

            return res.json({
                success: true,
                data: {
                    title: title,
                    platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                    quality: '720p',
                    size: data.size || '~10 MB',
                    downloadUrl: data.url,
                    filename: filename
                }
            });
        }

        // ===== FALLBACK: COBALT API =====
        const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                videoQuality: '720',
                audioFormat: 'mp3',
                downloadMode: 'auto'
            })
        });
        const cobaltData = await cobaltRes.json();

        if (cobaltData && cobaltData.status === 'success' && cobaltData.url) {
            const title = cobaltData.title || 'Video';
            const filename = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

            return res.json({
                success: true,
                data: {
                    title: title,
                    platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                    quality: '720p',
                    size: '~10 MB',
                    downloadUrl: cobaltData.url,
                    filename: filename
                }
            });
        }

        throw new Error('Gagal ambil data dari semua API');

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Terjadi kesalahan saat download'
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📥 Multi Downloader API siap! (Vevioz + Cobalt)`);
});
