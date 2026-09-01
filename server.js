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
// YOUTUBE + TIKTOK VIA VEVIOZ API
// ============================================
app.post('/api/download', async (req, res) => {
    const { url } = req.body;

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ success: false, error: 'URL tidak valid!' });
    }

    try {
        // Vevioz API - support YouTube, TikTok, IG, FB, dll
        const response = await fetch(`https://api.vevioz.com/api/button/mp4/${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data && data.url) {
            res.json({
                success: true,
                data: {
                    title: data.title || 'Video',
                    platform: 'YouTube/TikTok',
                    quality: '720p',
                    size: data.size || '~10 MB',
                    downloadUrl: data.url,
                    filename: (data.title || 'video').replace(/[^a-z0-9]/gi, '_').substring(0, 50)
                }
            });
        } else {
            // Fallback ke Cobalt API
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
                res.json({
                    success: true,
                    data: {
                        title: cobaltData.title || 'Video',
                        platform: 'YouTube/TikTok',
                        quality: '720p',
                        size: '~10 MB',
                        downloadUrl: cobaltData.url,
                        filename: (cobaltData.title || 'video').replace(/[^a-z0-9]/gi, '_').substring(0, 50)
                    }
                });
            } else {
                throw new Error('Gagal ambil data dari semua API');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Terjadi kesalahan saat download'
        });
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📥 Multi Downloader API siap! (Vevioz + Cobalt)`);
});
