# เว็บพอร์ตโฟลิโอถ่ายรูป (Netlify)

## ขึ้นเว็บ ทำครั้งเดียว
1. สมัคร github.com แล้วกด New repository ตั้งชื่ออะไรก็ได้ (เช่น portfolio) กด Create
2. ในหน้า repo กด "uploading an existing file" แล้วลากไฟล์ทั้งหมดที่แตกจาก zip ไปวาง
   (ต้องมีโฟลเดอร์ public, netlify และไฟล์ package.json, netlify.toml) แล้วกด Commit changes
3. เข้า app.netlify.com กด Add new site -> Import an existing project -> GitHub -> เลือก repo
   ไม่ต้องกรอก build command กด Deploy
4. ไปที่ Site configuration -> Environment variables -> Add a variable เพิ่ม 2 ค่า
   - ADMIN_PASSCODE = รหัสที่ใช้ล็อกอิน (ควรยาว 10 ตัวขึ้นไป)
   - SESSION_SECRET = พิมพ์ข้อความสุ่มยาว ๆ อะไรก็ได้
5. ไปที่ Deploys -> Trigger deploy -> Deploy site รอให้เสร็จ แล้วเปิดเว็บ

## ใช้งาน
ท้ายหน้าเว็บกด Owner login -> ใส่รหัส -> แก้ข้อความ เพิ่มรูปทีละหลายรูป ตั้งหมวด เรียงลำดับ ลบรูป -> กด Save
กด Save แล้วทุกคนเห็นทันที ไม่ต้องโหลดไฟล์

## หมายเหตุ
- เปลี่ยนรหัส: แก้ ADMIN_PASSCODE แล้ว Trigger deploy ใหม่
- ถ้าไม่ใช้ GitHub: npm i -g netlify-cli && npm install && netlify deploy --prod
