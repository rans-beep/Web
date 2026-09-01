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
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com') || url.includes('vt.tiktok') || url.includes('vm.tiktok')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('facebook.com')) return 'facebook';
    return 'unknown';
};

// ============================================
// YOUTUBE DOWNLOADER (Cobalt + Vevioz)
// ============================================
app.post('/api/ytdownload', async (req, res) => {
    const { url } = req.body;

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ success: false, error: 'URL tidak valid!' });
    }

    try {
        // Cobalt API
        const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                url: url,
                videoQuality: '720',
                audioFormat: 'mp3',
                downloadMode: 'auto'
            })
        });

        const cobaltData = await cobaltRes.json();

        if (cobaltData && cobaltData.status === 'success' && cobaltData.url) {
            const title = cobaltData.title || 'YouTube Video';
            return res.json({
                success: true,
                data: {
                    title: title,
                    platform: 'YouTube',
                    quality: '720p',
                    size: cobaltData.size || '~10 MB',
                    downloadUrl: cobaltData.url,
                    filename: title.replace(/[^a-z0-9]/gi, '_').substring(0, 50),
                    thumbnail: cobaltData.thumbnail || ''
                }
            });
        }

        // Fallback: Vevioz
        const veviozRes = await fetch(`https://api.vevioz.com/api/button/mp4/${encodeURIComponent(url)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const veviozData = await veviozRes.json();

        if (veviozData && veviozData.url) {
            const title = veviozData.title || 'YouTube Video';
            return res.json({
                success: true,
                data: {
                    title: title,
                    platform: 'YouTube',
                    quality: '720p',
                    size: veviozData.size || '~10 MB',
                    downloadUrl: veviozData.url,
                    filename: title.replace(/[^a-z0-9]/gi, '_').substring(0, 50),
                    thumbnail: veviozData.thumbnail || ''
                }
            });
        }

        throw new Error('Gagal ambil data YouTube');

    } catch (error) {
        console.error('❌ YT Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Terjadi kesalahan saat download YouTube'
        });
    }
});

// ============================================
// TIKTOK DOWNLOADER (TikWM API)
// ============================================
app.post('/api/ttdownload', async (req, res) => {
    const { url } = req.body;

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ success: false, error: 'URL tidak valid!' });
    }

    try {
        // ===== TIKWM API =====
        const formData = new URLSearchParams();
        formData.append('url', url);

        const tikwmRes = await fetch('https://tikwm.com/api/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: formData.toString()
        });

        const tikwmData = await tikwmRes.json();

        if (tikwmData && tikwmData.code === 0 && tikwmData.data && tikwmData.data.play) {
            const data = tikwmData.data;
            const title = data.title || 'TikTok Video';
            return res.json({
                success: true,
                data: {
                    title: title,
                    platform: 'TikTok',
                    quality: '720p',
                    size: data.size || '~5 MB',
                    downloadUrl: data.play,
                    filename: title.replace(/[^a-z0-9]/gi, '_').substring(0, 50),
                    thumbnail: data.cover || '',
                    author: data.author?.unique_id || 'Unknown'
                }
            });
        }

        // ===== FALLBACK: COBALT API =====
        const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                url: url,
                videoQuality: '720',
                audioFormat: 'mp3',
                downloadMode: 'auto'
            })
        });

        const cobaltData = await cobaltRes.json();

        if (cobaltData && cobaltData.status === 'success' && cobaltData.url) {
            const title = cobaltData.title || 'TikTok Video';
            return res.json({
                success: true,
                data: {
                    title: title,
                    platform: 'TikTok',
                    quality: '720p',
                    size: cobaltData.size || '~5 MB',
                    downloadUrl: cobaltData.url,
                    filename: title.replace(/[^a-z0-9]/gi, '_').substring(0, 50),
                    thumbnail: cobaltData.thumbnail || '',
                    author: cobaltData.author || 'Unknown'
                }
            });
        }

        throw new Error('Gagal ambil data TikTok');

    } catch (error) {
        console.error('❌ TT Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Terjadi kesalahan saat download TikTok'
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
    console.log(`📥 Multi Downloader API siap! (YT: Cobalt+Vevioz, TT: TikWM+Cobalt)`);
});
