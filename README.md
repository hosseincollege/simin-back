# بک‌اند سیمین

API پروژه با NestJS ساخته شده است. در اجرای محلی، فرانت روی پورت 4200 و API روی پورت 3001 اجرا می‌شود.

نقشهٔ محصول و جریان سرمایه‌گذار/تولیدکننده در `../front/docs/PRODUCT-PLAN.fa.md` نگه‌داری می‌شود.

## راه‌اندازی محلی

1. فایل `.env.example` را به `.env` کپی کنید.
2. مقدارهای اتصال SQL Server را در `.env` تنظیم کنید.
3. برای JWT، یک secret تصادفی با حداقل ۳۲ نویسه قرار دهید؛ این secret را در مخزن یا پیام‌ها منتشر نکنید.
4. در پوشهٔ back فرمان‌های `npm install` و `npm run start:dev` را اجرا کنید.
5. مسیر `http://localhost:3001/api/health` باید وضعیت سرویس را برگرداند.

برای ساخت production از `npm run build` و سپس `npm run start:prod` استفاده کنید. مبدأ فرانت با `FRONTEND_ORIGIN` تنظیم می‌شود.

## مسیرهای API فعلی

- `GET /api/health`: بررسی سلامت سرویس.
- `POST /api/auth/register`: ساخت حساب و هش رمز با bcrypt.
- `POST /api/auth/login`: ورود و دریافت JWT امضاشده با انقضای ۸ ساعته.
- `GET /api/auth/me`: اعتبارسنجی Bearer token و برگرداندن مشخصات عمومی کاربر.
- `GET /api/workshops`: فقط کارگاه‌های منتشرشده.
- `GET /api/workshops/:id`: مشاهدهٔ کارگاه منتشرشده.
- `GET /api/workshops/mine` و `GET /api/workshops/mine/:id`: پرونده‌های کاربر واردشده.
- `GET /api/workshops/interests/mine`: فرصت‌های منتشرشده‌ای که کاربر برای پیگیری ذخیره کرده است.
- `POST /api/workshops/:id/interest` و `POST /api/workshops/:id/interest/remove`: افزودن/حذف علاقه‌مندی حساب کاربر؛ این کار رزرو یا تعهد مالی ایجاد نمی‌کند.
- `POST /api/workshops/:id/inquiries`: ثبت درخواست معرفی غیرالزام‌آور همراه با رضایت صریح برای نمایش نام و نام کاربری به مالک؛ هر کاربر برای هر کارگاه یک درخواست ثبت می‌کند.
- `GET /api/workshops/mine/inquiries`: فهرست درخواست‌های معرفی‌ای که سرمایه‌گذار فرستاده است.
- `GET /api/workshops/mine/:id/inquiries` و `PATCH /api/workshops/mine/:id/inquiries/:inquiryId`: مشاهدهٔ درخواست‌های کارگاه و به‌روزرسانی وضعیت توسط مالک همان کارگاه.
- `GET /api/workshops/:id/reports`: گزارش‌های دوره‌ای بازبینی‌شده برای کارگاه منتشرشده.
- `GET /api/workshops/mine/:id/reports` و `POST /api/workshops/:id/reports`: مشاهده و ثبت گزارش دوره‌ای توسط مالک کارگاه.
- `PATCH /api/workshops/:id/reports/:reportId` و `GET /api/workshops/mine/:id/reports/:reportId/history`: اصلاح گزارش توسط مالک با نگه‌داری snapshot قبلی در همان تراکنش؛ گزارش اصلاح‌شده دوباره در انتظار بازبینی قرار می‌گیرد.
- `GET /api/workshops/reports/review-queue` و `POST /api/workshops/:id/reports/:reportId/check`: صف و بازبینی اولیهٔ گزارش‌ها برای مدیر.
- `POST /api/workshops/:id/documents`: بارگذاری مدرک خصوصی PDF/PNG/JPEG (حداکثر ۱۰ مگابایت) توسط مالک کارگاه.
- `GET /api/workshops/mine/:id/documents`: فهرست مدارک خصوصی مالک.
- `GET /api/workshops/documents/review-queue`، `GET /api/workshops/:id/documents/:documentId/download` و `POST /api/workshops/:id/documents/:documentId/review`: صف، دریافت فایل و بازبینی مدیر.
- `POST /api/workshops` و `PATCH /api/workshops/:id`: ساخت/ویرایش پیش‌نویس متعلق به کاربر.
- `POST /api/workshops/:id/submit`: ارسال پیش‌نویس یا پروندهٔ اصلاح‌شده برای بررسی.
- `GET /api/workshops/review-queue`: صف بررسی مدیر.
- `GET /api/workshops/:id/review-history`: تاریخچهٔ رویدادها برای مالک پرونده یا مدیر.
- `POST /api/workshops/:id/request-revision`: درخواست اصلاح با یادداشت مدیر.
- `POST /api/workshops/:id/publish`: انتشار پیش‌نویس فقط برای مدیر.

ساخت/ویرایش پرونده علاوه بر اطلاعات پایه، محصول اصلی، ظرفیت فعلی و هدف، هدف طرح، مدت اجرا و سه قلم مصرف سرمایه را می‌گیرد. جمع تجهیزات، سرمایهٔ در گردش و سایر هزینه‌ها باید برابر `requiredCapital` باشد؛ مبلغ‌ها به تومان و با رقم فارسی/عربی یا لاتین پذیرفته می‌شوند. این داده‌ها اطلاعات خوداظهاری‌اند و مدرک یا راستی‌آزمایی مالی به آن‌ها متصل نیست.

JWT_SECRET در زمان ساخت ماژول اعتبارسنجی می‌شود؛ اگر تنظیم نشده یا کوتاه باشد، سرور بالا نمی‌آید. JWT در هر درخواست احراز‌شده با رکورد فعلی کاربر در SQL Server تطبیق می‌شود تا تغییر نقش بلافاصله اعمال شود. تغییر وضعیت پرونده و سابقهٔ رویداد آن، و اصلاح گزارش و نگه‌داری نسخهٔ پیشین، تراکنشی هستند. نقش ارزیاب برای بررسی و اصلاح و نقش مدیر برای انتشار نهایی در APIهای کارگاه از هم جدا و کنترل می‌شوند. علاقه‌مندی‌های پیگیری پیاده‌سازی شده‌اند؛ معامله، قرارداد، احراز هویت مالی، پرداخت و تسویه وجود ندارند.

## وضعیت و محدودیت‌ها

ثبت‌نام عمومی همیشه نقش `user` می‌گیرد. برای تعیین مدیر اولیه، ابتدا حساب را از رابط ثبت‌نام ایجاد کنید و سپس با دسترسی کنترل‌شده به SQL Server، نقش همان نام کاربری را تغییر دهید:

```sql
UPDATE dbo.[User] SET role = N'admin' WHERE username = N'<username>';
-- برای اختصاص نقش ارزیاب به حساب دیگری:
UPDATE dbo.[User] SET role = N'reviewer' WHERE username = N'<username>';
```

این کار را فقط اپراتور مجاز در محیط استقرار انجام دهد؛ حساب مدیر یا رمز ثابت را در کد، مخزن یا فایل عمومی قرار ندهید. نقش فعلی کاربر در هر درخواست احرازشده از پایگاه‌داده خوانده می‌شود و تغییر نقش بلافاصله روی مجوزها اثر می‌گذارد.

جدول‌های User، Workshop، WorkshopReviewEvent، WorkshopInterest، WorkshopInquiry، WorkshopReport، WorkshopReportRevision و WorkshopDocument در SQL Server هنگام بالا آمدن API به‌شکل idempotent ساخته می‌شوند و با پرس‌وجوی مستقیم بستهٔ `mssql` استفاده می‌شوند. فایل Prisma schema وجود دارد، اما Prisma Client هنوز مسیر persistence جاری نیست. گزارش‌ها خوداظهاری‌اند و فقط پس از بازبینی مدیر در جزئیات عمومی نمایش داده می‌شوند؛ این بازبینی حسابرسی مستقل نیست. درخواست‌های معرفی پس از رضایت کاربر، نام و نام کاربری را فقط به مالک همان کارگاه نشان می‌دهند؛ پیام‌رسانی امن درون‌سامانه‌ای وجود ندارد. فایل‌های مدرک بیرون از مسیر static، در `PRIVATE_DOCUMENT_DIR` (پیش‌فرض `back/private-documents`) ذخیره می‌شوند و برای دانلود احراز هویت و مالکیت لازم است. این پوشه باید در استقرار پایدار و پشتیبان‌گیری شود؛ اسکن بدافزار و تاریخچهٔ تغییر/حذف مدارک هنوز تکمیل نشده است. قرارداد و پرداخت وجود ندارند.

پیش از عرضهٔ عمومی باید نقش‌ها و مجوز مالکیت برای همهٔ endpointهای خصوصی، محدودیت تلاش ورود، migration نسخه‌دار، آزمون‌های امنیتی و پایش تکمیل شوند.
