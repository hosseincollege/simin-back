# بک‌اند سیمین

API پروژه با NestJS ساخته شده است. در اجرای محلی، فرانت روی پورت 4200 و API روی پورت 3001 اجرا می‌شود.

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
- `POST /api/workshops` و `PATCH /api/workshops/:id`: ساخت/ویرایش پیش‌نویس متعلق به کاربر.
- `POST /api/workshops/:id/submit`: ارسال پیش‌نویس یا پروندهٔ اصلاح‌شده برای بررسی.
- `GET /api/workshops/review-queue`: صف بررسی مدیر.
- `GET /api/workshops/:id/review-history`: تاریخچهٔ رویدادها برای مالک پرونده یا مدیر.
- `POST /api/workshops/:id/request-revision`: درخواست اصلاح با یادداشت مدیر.
- `POST /api/workshops/:id/publish`: انتشار پیش‌نویس فقط برای مدیر.

JWT_SECRET در زمان ساخت ماژول اعتبارسنجی می‌شود؛ اگر تنظیم نشده یا کوتاه باشد، سرور بالا نمی‌آید. نقش مدیر و مالکیت پرونده در APIهای کارگاه کنترل می‌شوند؛ APIهای سرمایه‌گذاری هنوز پیاده‌سازی نشده‌اند.

## وضعیت و محدودیت‌ها

جدول User و Workshop در SQL Server ساخته و با پرس‌وجوی مستقیم بستهٔ `mssql` استفاده می‌شوند. فایل Prisma schema وجود دارد، اما Prisma Client هنوز مسیر persistence جاری نیست. API مدارک، فرصت‌های سرمایه‌گذاری، گزارش‌ها و پرداخت ساخته نشده‌اند؛ در فرانت بعضی داده‌ها نمونه یا localStorage هستند.

پیش از عرضهٔ عمومی باید نقش‌ها و مجوز مالکیت برای همهٔ endpointهای خصوصی، محدودیت تلاش ورود، migration نسخه‌دار، آزمون‌های امنیتی و پایش تکمیل شوند.
