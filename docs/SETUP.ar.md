# Meetly — محاضر الاجتماعات

موقع عام: أي حد بيسجل دخول بحساب Google، بيرفع تسجيل اجتماع (من جهازه أو رابط Google Drive)،
وبيوصل المحضر للحضور بالإيميل، وبيقدر يسأل عن أي اجتماع (أو عن كلهم مع بعض).

## كيف بيشتغل

```
المتصفح (web/ → Next.js)  ←→  الباك إند FastAPI (app/main.py)  ←→  قاعدة البيانات (Firestore أو ملفات data/)
                                │
                                └→ العامل بالخلفية (app/worker.py):
                                   الفيديو → Gemini (نص) → GPT-6 Luna (محضر) → PDF بهوية Meetly بالإيميل
```

| الملف | شو بيعمل |
|---|---|
| `web/` | الواجهة (تصميم «ديوان Meetly»): Next.js + GSAP + Lenis |
| `web/app/page.js` | الصفحة الرئيسية بالمشاهد الستة |
| `web/app/login`, `meetings`, `new`, `chat`, `privacy` | تسجيل الدخول، الأرشيف والمحضر، مجلس جديد، اسأل الكاتب، الخصوصية |
| `web/lib/i18n.js` | كل النصوص عربي/إنجليزي |
| `web/app/globals.css`, `landing.css`, `app.css` | التصميم (الألوان والخطوط والملمس) |
| `web/out/` | **الموقع جاهز** بعد البناء: هاد اللي بيعرضه FastAPI |
| `app/main.py` | الباك إند: تسجيل الدخول وكل الـ API، وبيعرض صفحات `web/out` |
| `app/worker.py` | معالجة الاجتماع بالخلفية |
| `app/ai.py` | Gemini للتفريغ و Luna للمحضر والأسئلة |
| `app/store.py` | حفظ الاجتماعات (Firestore على Google، أو ملفات على جهازك) |
| `app/blobs.py` | تخزين الفيديوهات المرفوعة مؤقتاً |
| `app/mailer.py` | إرسال المحضر PDF بالإيميل باسم Meetly |
| `app/pdf.py` + `app/fonts/` | ملف PDF للمحضر بهوية Meetly (عربي وإنجليزي) |
| `deploy.sh` + `Dockerfile` | النشر على Google Cloud (الـ Dockerfile بيبني الواجهة لحاله) |
| `colab_run.py` | تشغيل الموقع على Colab |

### الواجهة جاهزة ومبنية
فولدر `web/out` جاهز بالـ zip، فـ **Colab ما بيحتاج Node**. بس إذا عدّلت على التصميم بـ `web/`، لازم تعيد البناء مرة:

```bash
cd web
npm install      # أول مرة بس
npm run build    # بيكتب الموقع الجديد بـ web/out
```

على Colab بتقدر تعملها بخلية: `!cd web && npm install && npm run build`

---|---|
| `static/index.html` | صفحة البداية |
| `static/login.html` | تسجيل الدخول / حساب جديد (Google) |
| `static/new.html` + `new.js` | اجتماع جديد: التسجيل، العنوان، إيميل كل شخص بخانة لحاله |
| `static/meetings.html` + `meetings.js` | الاجتماعات والمحضر الكامل |
| `static/chat.html` + `chat.js` | الشات بوت: بتختار الاجتماع وبتسأل |
| `static/common.js` | النصوص عربي/إنجليزي، الوضع الفاتح/الغامق، القائمة الجانبية |
| `static/styles.css` | التصميم |
| `app/main.py` | الباك إند: تسجيل الدخول وكل الـ API |
| `app/worker.py` | معالجة الاجتماع بالخلفية |
| `app/ai.py` | Gemini للتفريغ (قطع كل 15 دقيقة، وبيستنى إذا السيرفر مضغوط) و Luna للمحضر والأسئلة |
| `app/store.py` | حفظ الاجتماعات (Firestore على Google، أو ملفات على جهازك) |
| `app/blobs.py` | تخزين الفيديوهات المرفوعة مؤقتاً |
| `app/mailer.py` | إرسال الإيميلات باسم Meetly من Gmail الموقع |
| `app/pdf.py` | ملف PDF مرتب للمحضر بهوية Meetly، مرفق بالإيميل وبينزل من صفحة الاجتماع |
| `app/schema.py`, `app/report.py` | شكل المحضر |
| `deploy.sh` | بينشر كل إشي على Google Cloud بأمر واحد |
| `colab_run.py` | تجربة الموقع على Colab قبل النشر |

---

## 1) جرّبه على Colab أول

```python
from google.colab import drive
drive.mount('/content/drive')
%cd /content/drive/MyDrive/meeting-web
!pip install -q -r requirements.txt
%run colab_run.py
```

بيسألك عن المفاتيح، وبيطبعلك رابط. افتحه وسجل دخول بأي إيميل (هاد وضع تجربة).

- لتجرب إنك "مدعو"، افتح الرابط بنافذة خفية وسجل بإيميل واحد من الحضور.
- الرفع من الجهاز على Colab محدود بـ 100MB تقريباً (حد الرابط المؤقت). للفيديوهات الكبيرة استخدم رابط Drive.
  على Google Cloud ما في هالحد.

### 1-ب) خلّي الناس يجربوه من Colab بتسجيل Google حقيقي

رابط Cloudflare بيتغير كل مرة، و Google بدها رابط ثابت. فبنستخدم رابط ngrok الثابت (مجاني):

1. اعمل حساب على [ngrok.com](https://ngrok.com). من **Your Authtoken** انسخ الـ token، ومن **Domains** خذ الدومين المجاني (مثل `abc-xyz.ngrok-free.app`).
2. على [console.cloud.google.com](https://console.cloud.google.com) ← **Google Auth Platform**:
   - **Branding**: اسم التطبيق وإيميلك.
   - **Audience**: **External** ← **Publish app**.
   - **Clients** ← **Create client** ← **Web application** ← **Authorized redirect URIs**: `https://الدومين-تبعك.ngrok-free.app/auth/callback`
3. بـ Colab، من أيقونة المفتاح 🔑 (Secrets) ضيف 4 أسرار وفعّل لكل واحد **Notebook access**:
   `NGROK_AUTHTOKEN` ، `NGROK_DOMAIN` ، `GOOGLE_CLIENT_ID` ، `GOOGLE_CLIENT_SECRET`
4. شغّل `%run colab_run.py`. بيطلعلك الرابط الثابت، وأي حد بيقدر يعمل حساب بـ Google.

الموقع بيضل شغال طول ما خلية Colab شغالة. للتشغيل الدائم: الخطوة 3 (Google Cloud).

> الاجتماعات بتنحفظ بفولدر `data` جوا المشروع. إذا بدك تبلّش من الصفر (بدون اجتماعات التجربة)، احذف فولدر `data`.

### 1-ج) ملف الـ PDF للمحضر

الموقع بيعمل ملف PDF للمحضر لحاله بهوية Meetly (أسود وأحمر مع الشعار)، بدون Google Docs وبدون أي ربط إضافي.
بيوصل مرفق بالإيميل لكل الحضور، وبينزل من زر **PDF** بصفحة الاجتماع. إذا الاجتماع بالعربي، الملف بيطلع من اليمين لليسار.

### أسئلة الشات بوت بالإيميل
بالإيميل في أسئلة جاهزة من نفس الاجتماع. لما الشخص يكبس سؤال، بيسجل دخول (Google بيقترح نفس الإيميل اللي وصله المحضر)،
وبيرجع مباشرة على الشات بوت والسؤال بينسأل لحاله.

---

## 2) حضّر إيميل الموقع (مرة وحدة)

1. اعمل حساب Gmail جديد للموقع، مثلاً `meetingminutes.app@gmail.com`.
2. فعّل **2-Step Verification** عليه: myaccount.google.com ← Security.
3. روح على myaccount.google.com/apppasswords واعمل App Password، رح يطلعلك 16 حرف.
4. هدول بيكونوا `SMTP_USER` (الإيميل) و `SMTP_PASSWORD` (الـ 16 حرف).

الإيميل بيوصل للحضور باسم **Meetly**، وجواته مكتوب "From" اسم وإيميل الشخص اللي رفع الاجتماع.
ولما حدا يرد، الرد بيروح لإيميل الشخص نفسه.

Gmail بيسمح بحوالي 500 إيميل باليوم. لما يكبر الموقع، بنحوّل لخدمة إيميل بدومين خاص.

---

## 3) انشره على Google Cloud

**قبل:** لازم يكون عندك مشروع على [console.cloud.google.com](https://console.cloud.google.com) والـ Billing مفعّل
(اكبس **Start free** بالشريط فوق: $300 رصيد مجاني، وما بيسحب من البطاقة إلا إذا وافقت).
(في رصيد مجاني للحسابات الجديدة، والاستخدام الخفيف غالباً ضمن الحدود المجانية.)

1. افتح [Cloud Shell](https://shell.cloud.google.com): هو terminal بالمتصفح، ما بتحتاج تنزّل إشي.
2. ارفع ملف `meetly-diwan.zip` (من القائمة ⋮ ← Upload)، وبعدين:
   ```bash
   unzip meetly-diwan.zip && cd meeting-web
   gcloud config set project اسم-مشروعك
   cp deploy.env.example deploy.env
   nano deploy.env        # عبّي المفاتيح، وبعدين Ctrl+O ثم Enter ثم Ctrl+X
   bash deploy.sh
   ```
3. بالآخر بيطبعلك **رابط الموقع**.

### تسجيل الدخول بـ Google (بعد أول نشر)

1. افتح console.cloud.google.com ← **Google Auth Platform**:
   - **Branding**: اسم التطبيق وإيميلك.
   - **Audience**: اختار **External**.
   - **Audience** ← اكبس **Publish app** (بنطلب الاسم والإيميل بس، فما بيحتاج مراجعة من Google).
   - **Clients** ← **Create client** ← **Web application**.
     - **Authorized redirect URI**: الرابط اللي طبعه السكربت، مثلاً `https://meeting-app-xxxx.run.app/auth/callback`
2. انسخ **Client ID** و **Client secret** على `deploy.env`.
3. شغّل `bash deploy.sh` مرة ثانية.


### تحديث الموقع بعدين
أي تعديل على الكود أو على `deploy.env`: ارفع الملفات الجديدة وشغّل `bash deploy.sh`.

---

## الحدود والأمان

- كل مستخدم: لحد `MAX_MEETINGS_PER_DAY` اجتماع باليوم، وكل فيديو لحد `MAX_VIDEO_MINUTES` دقيقة.
- كل واحد بيشوف اجتماعاته واللي انعزم عليها بس.
- الفيديوهات بتنحذف بعد ما تتعالج (وبعد 3 أيام كحد أقصى لو فشلت).
- `deploy.env` فيه أسرارك. لا ترفعه على GitHub ولا تشاركه.
