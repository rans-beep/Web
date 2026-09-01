import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { existsSync, mkdirSync, statSync, unlinkSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// SERVE STATIC FILES (index.html)
// ============================================
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// CUSTOM EXEC DENGAN TIMEOUT PANJANG
// ============================================
const execAsync = (cmd, options = {}) => {
    return new Promise((resolve, reject) => {
        exec(cmd, {
            ...options,
            timeout: 600000, // 10 menit
            maxBuffer: 50 * 1024 * 1024 // 50MB buffer
        }, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve({ stdout, stderr });
        });
    });
};

const tmpDir = path.join(__dirname, 'tmp');

// Buat folder tmp
if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
    console.log(`📁 Folder tmp dibuat: ${tmpDir}`);
}

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
        'bilibili': ['bilibili.com', 'b23.tv'],
        'douyin': ['douyin.com'],
        'kuaishou': ['kuaishou.com']
    };
    for (const [platform, domains] of Object.entries(platforms)) {
        if (domains.some(d => url.includes(d))) return platform;
    }
    return 'unknown';
};

// ============================================
// ENDPOINT DOWNLOAD
// ============================================
app.post('/api/download', async (req, res) => {
    const { url, quality = 'best' } = req.body;

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ success: false, error: 'URL tidak valid!' });
    }

    const platform = detectPlatform(url);
    const timestamp = Date.now();
    const outputFile = path.join(tmpDir, `download_${timestamp}.mp4`);

    try {
        let command;
        if (quality !== 'best') {
            command = `yt-dlp -f "best[height<=${quality}]" --merge-output-format mp4 -o "${outputFile}" "${url}" --no-warnings --ignore-errors --no-check-certificate`;
        } else {
            command = `yt-dlp -f "best" --merge-output-format mp4 -o "${outputFile}" "${url}" --no-warnings --ignore-errors --no-check-certificate`;
        }

        console.log(`📥 Downloading from ${platform}: ${url}`);
        console.log(`🔧 Command: ${command}`);

        await execAsync(command);

        if (!existsSync(outputFile)) {
            return res.status(404).json({ success: false, error: 'Gagal download, coba link lain.' });
        }

        const stats = statSync(outputFile);
        const fileSizeMB = stats.size / (1024 * 1024);

        let title = `Video_${timestamp}`;
        try {
            const titleCmd = `yt-dlp --get-title "${url}" --no-warnings`;
            const { stdout } = await execAsync(titleCmd, { timeout: 30000 });
            title = stdout.trim() || title;
            title = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        } catch (e) {}

        console.log(`✅ Selesai: ${title} (${fileSizeMB.toFixed(2)}MB)`);

        res.json({
            success: true,
            data: {
                title: title,
                platform: platform,
                quality: quality,
                size: fileSizeMB.toFixed(2) + ' MB',
                downloadUrl: `/download/${path.basename(outputFile)}`,
                filename: path.basename(outputFile)
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        if (existsSync(outputFile)) {
            try { unlinkSync(outputFile); } catch (e) {}
        }
        
        // Kirim pesan error yang lebih jelas
        let errorMessage = error.message || 'Terjadi kesalahan saat download';
        if (errorMessage.includes('yt-dlp')) {
            errorMessage = 'yt-dlp tidak ditemukan. Pastikan sudah terinstall.';
        } else if (errorMessage.includes('ffmpeg')) {
            errorMessage = 'ffmpeg tidak ditemukan. Pastikan sudah terinstall.';
        } else if (errorMessage.includes('Video not available')) {
            errorMessage = 'Video tidak tersedia atau dihapus.';
        }
        
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// ============================================
// ENDPOINT DOWNLOAD FILE
// ============================================
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(tmpDir, filename);

    if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'File tidak ditemukan' });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Download error:', err);
        }
        setTimeout(() => {
            if (existsSync(filePath)) {
                try { unlinkSync(filePath); } catch (e) {}
                console.log(`🗑️ File dihapus: ${filename}`);
            }
        }, 5000);
    });
});

// ============================================
// CLEANUP TMP FOLDER
// ============================================
setInterval(() => {
    try {
        const files = readdirSync(tmpDir);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(tmpDir, file);
            const stats = statSync(filePath);
            const age = (now - stats.mtimeMs) / 1000 / 60;
            if (age > 10) {
                unlinkSync(filePath);
                console.log(`🗑️ Auto cleanup: ${file}`);
            }
        });
    } catch (e) {}
}, 60000);

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
    console.log(`📥 Multi Downloader API siap!`);
    console.log(`📁 TMP folder: ${tmpDir}`);
});
