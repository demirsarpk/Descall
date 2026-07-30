# TURN + DM / Grup arama test matrisi

Bu doküman, iki tarayıcı (veya tarayıcı + Electron) ile **çevrimiçi / çevrimdışı** senaryolarında ses, video ve ekran paylaşımını doğrulamak içindir.

## Ön koşullar

- Production veya staging: `https://des-call.onrender.com` (veya yerel `npm run dev` + backend).
- İki farklı kullanıcı hesabı (A ve B), tercihen farklı cihazlarda.
- TURN testi için Render/backend ortamında `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` (veya `ICE_SERVERS_JSON`) ayarlı olmalı.
- İstemci: `GET /api/webrtc/ice-config` yanıtında `turnConfigured: true` olmalı (opsiyonel kontrol).

## Ortam matrisi

| # | Ağ A | Ağ B | TURN beklenen | Not |
|---|------|------|---------------|-----|
| 1 | Normal Wi‑Fi | Normal Wi‑Fi | Hayır (STUN yeterli) | Temel DM ses |
| 2 | Normal Wi‑Fi | Normal Wi‑Fi | Hayır | DM video + ekran 720p |
| 3 | Mobil hotspot | Ev Wi‑Fi | **Evet** | Simetrik NAT |
| 4 | Kurumsal VPN | Ev | **Evet** | UDP kısıtlı olabilir |
| 5 | A çevrimdışı (sekme kapalı) | B arar | — | B: “offline / waiting” UI, `call:unreachable` yumuşak |
| 6 | A sekme açık, socket kopuk | B arar | — | Yeniden bağlanınca teklif |

## DM arama (1:1)

Her satır için: **A → B arama başlat**, B kabul, 60 sn konuş, A kapat.

| Senaryo | Adımlar | Beklenen |
|---------|---------|----------|
| Ses | A ses araması | Gelen popup (floating), kabul, süre sayacı |
| Video | A video | Uzak video görünür, kamera toggle çalışır |
| Red | B red | A temiz kapanır, özet balonu (varsa) JSON değil |
| Ekran | A paylaş, kalite 720p/20 | B uzak ekranı akıcı görür |
| Kalite değişimi | Paylaşım açıkken 480p | Kısa kesinti, yeniden paylaşım, bozulmama |

## Grup arama

Üç kullanıcı (A başlatıcı, B, C) veya iki kullanıcı + ikinci sekme.

| Senaryo | Beklenen |
|---------|----------|
| Gelen grup çağrısı | `group:call:incoming` popup |
| Katılım | Herkeste katılımcı sayısı doğru |
| Ekran (mesh) | 3+ kişide 720p/20 önerisi; 1080p uyarı panelde |
| Ayrılma | Kalanlar devam eder, SFU yok (mesh P2P) |

## ICE / TURN doğrulama

1. `chrome://webrtc-internals` (veya Firefox about:webrtc) açın.
2. Aktif `RTCPeerConnection` → **candidate pair** seçili olsun.
3. Senaryo 3–4’te relay (`typ relay`) adayları görülmeli.
4. Bağlantı `connected` / `completed`; `failed` olmamalı (5 dk test).

## Regresyon kontrol listesi

- [ ] DM gelen arama 30 sn sonra otomatik red
- [ ] Grup gelen arama popup
- [ ] `call_summary` sohbette `CallSummaryBubble`, ham JSON yok
- [ ] Ekran kalite paneli CallOverlay’de açılır/kapanır, paylaşım sırasında bozulmaz
- [ ] Windows indirme: GitHub **latest** release `.exe` linki

## Otomasyon

WebRTC E2E tarayıcıda tam otomatik değildir; yukarıdaki matris **manuel** smoke test içindir. CI’da yalnızca `GET /api/webrtc/ice-config` ve `GET /health` doğrulanabilir.
