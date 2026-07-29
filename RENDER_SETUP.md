# Render Deploy — Descall (des-call)

**Canlı URL:** https://des-call.onrender.com

## 1. İlk kurulum (Blueprint)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. GitHub repo: `demirrsarppkurtlarr/Descall` → branch `main`
3. Render **otomatik sorar** (ilk kurulumda):
   - `SUPABASE_URL` — Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role anahtarı
4. `JWT_SECRET` otomatik üretilir (`generateValue: true`)
5. **Apply** → deploy başlar

### Supabase değerlerini nereden alırsın?

1. [Supabase Dashboard](https://supabase.com/dashboard) → projeni seç
2. **Settings** → **API**
3. Kopyala:

| Render değişkeni | Supabase alanı |
|------------------|----------------|
| `SUPABASE_URL` | **Project URL** (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (secret) |

> **Dikkat:** `anon` / `public` key kullanma — sadece `service_role`.

## 2. Kurulum sihirbazı (önerilen)

Terminalde repo kökünden:

```bash
npm run setup:render
```

Sorular:
- Supabase URL
- Service role key (gizli giriş)
- JWT secret (otomatik üret veya elle gir)

Çıktı: `render.env` dosyası → Render Dashboard → **Environment** → **Add from .env** → yapıştır → **Save & Deploy**

Alternatif: `render.env.example` dosyasını doldurup aynı şekilde yapıştır.

## 3. Veritabanı migration

Supabase SQL Editor'da `supabase/migrations/` klasöründeki dosyaları sırayla çalıştır (veya Supabase CLI ile push).

## 4. Ortam değişkenleri özeti

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `SUPABASE_URL` | Evet | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Backend DB erişimi |
| `JWT_SECRET` | Evet | Oturum imzalama (Render üretebilir) |
| `JWT_EXPIRES_IN` | Hayır | Varsayılan `7d` |
| `VITE_API_BASE_URL` | Evet | `https://des-call.onrender.com` |
| `PORT` | Hayır | Render otomatik `3000` |

## 5. Sorun giderme

**Build: `vite: not found`**
- `npm install --include=dev` build komutunda olmalı (render.yaml'da mevcut)

**`Missing SUPABASE_URL`**
- Environment sekmesinde değerleri kontrol et
- `npm run setup:render` ile yeniden oluştur

**Deploy olmuyor**
- Settings → **Auto Deploy: Yes**
- veya Manual Deploy → Deploy latest commit

## Linkler

- Render: https://dashboard.render.com/
- GitHub: https://github.com/demirrsarppkurtlarr/Descall
- Supabase API ayarları: https://supabase.com/dashboard/project/_/settings/api
