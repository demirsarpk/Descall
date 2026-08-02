# Staging → Production akışı

Descall’ta iki canlı ortam vardır:

| Ortam | URL | Git branch | Render service |
|-------|-----|------------|----------------|
| **Staging (test)** | https://des-call-staging.onrender.com | `staging` | `des-call-staging` |
| **Production (ana)** | https://des-call.onrender.com | `main` | `des-call` |

## Neden?

Değişiklikleri önce staging’de dene. Sorun yoksa `main`’e al → ana site güncellenir.

## Günlük kullanım

```bash
# 1) Feature branch üzerinde çalış
git checkout -b cursor/my-feature-5e77

# 2) PR aç — base olarak `staging` kullan (önce test)
#    veya staging'e merge et:
git push -u origin HEAD
gh pr create --base staging --title "…" --body "…"

# 3) Staging merge olunca Render otomatik deploy eder
#    Test: https://des-call-staging.onrender.com

# 4) Staging iyi görünüyorsa production'a al
gh pr create --base main --head staging --title "Promote staging → production"
# veya:
git checkout main
git pull origin main
git merge origin/staging
git push origin main
```

## Kurallar

1. **Production’a (`main`) direkt büyük değişiklik push etme** — önce staging.
2. Electron / Setup release’leri **her zaman production** API’ye bağlanır (`https://des-call.onrender.com`). Staging URL Electron’da kullanılmaz; release tag’leri `main` üzerinden kesilir.
3. Staging ve production aynı Supabase projesini paylaşabilir (ücretsiz kurulum).  
   Tam izolasyon istersen staging için ayrı Supabase projesi kullan.
4. Free plan: 15 dk idle sonra sleep — ilk istek yavaş olabilir.

## Render’da staging oluşturma

Blueprint (`render.yaml`) senkron ise Render Dashboard → Blueprint → **Apply** staging servisini ekler.

Manuel:

1. Render → **New Web Service** → aynı GitHub repo
2. Name: `des-call-staging`
3. Branch: `staging`
4. Build / start: production ile aynı (`render.yaml` içindeki komutlar)
5. Env: production’daki Supabase değerlerini kopyala  
   `VITE_API_BASE_URL=https://des-call-staging.onrender.com`  
   `APP_ENV=staging`

## GitHub Deploy Hooks (opsiyonel)

| Secret | Ne zaman |
|--------|----------|
| `RENDER_DEPLOY_HOOK_URL` | `main` push → production |
| `RENDER_STAGING_DEPLOY_HOOK_URL` | `staging` push → staging |

Render Dashboard → Service → **Settings** → **Deploy Hook** URL’ini kopyala.

## Google OAuth

Staging kullanıyorsan Google Cloud Console’a origin ekle:

- `https://des-call-staging.onrender.com`
