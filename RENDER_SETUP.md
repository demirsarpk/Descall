# Render Deploy Ayarları

## Sorun: GitHub Push → Render Deploy Olmuyor

### Çözüm 1: Render Dashboard'dan Auto Deploy Aç

1. https://dashboard.render.com/ adresine git
2. Descall Backend service'ini aç
3. **Settings** sekmesine tıkla
4. **Auto Deploy** bölümünde: **Yes**
5. **Save Changes**

### Çözüm 2: Deploy Hook ile Manuel Trigger (Daha Güvenilir)

#### Adım 1: Deploy Hook URL Al

1. Render Dashboard → Descall Backend → Settings
2. **Deploy Hook** bölümünde **Create Deploy Hook** butonu
3. İsim: `github-auto-deploy`
4. URL'i kopyala (şuna benzer):
   ```
   https://api.render.com/v1/services/srv-XXXX/deploys
   ```

#### Adım 2: GitHub Secret Ekle

1. GitHub Repo → Settings → Secrets and variables → Actions
2. **New repository secret**
3. Name: `RENDER_DEPLOY_HOOK_URL`
4. Secret: (yukarıdaki URL'i yapıştır)
5. **Add secret**

✅ Artık her push yapıldığında otomatik deploy olacak!

### Çözüm 3: Manuel Deploy (Acil Durumlar)

```bash
# Deploy hook URL ile
curl -X POST https://api.render.com/v1/services/srv-XXXX/deploys
```

veya Render Dashboard'dan **Manual Deploy** → **Deploy latest commit**

## Dashboard URL
- **Render:** https://dashboard.render.com/
- **GitHub Repo:** https://github.com/demirrsarppkurtlarr/Descall

## Troubleshooting

**"Deploy hook failed" hatası:**
- Hook URL'in doğru olduğundan emin ol
- Service ID değişmiş olabilir, yeni hook oluştur

**"Build failed" hatası:**
- Render Logs sekmesinden detayları gör
- Genelde `npm install` veya başlangıç komutu hatası

**Deploy çok uzun sürüyor:**
- Build cache'i temizle: Manual Deploy → Clear build cache & deploy
