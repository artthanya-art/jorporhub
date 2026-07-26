import { createClient } from "@supabase/supabase-js";

// อ่านค่าจาก environment variables — ต้องตั้งค่าไว้ 2 ที่:
// 1. ในเครื่อง: ไฟล์ .env (คัดลอกจาก .env.example แล้วกรอกค่าจริง)
// 2. บน Vercel: Project Settings > Environment Variables (ชื่อตัวแปรต้องตรงกันเป๊ะ)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // เตือนตั้งแต่ตอนเปิดแอป ถ้าลืมตั้งค่า env var จะได้รู้ทันทีแทนที่จะไป error
  // แปลกๆ ตอนเรียก Supabase ทีหลัง
  console.error(
    "ไม่พบ VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY — ตรวจสอบไฟล์ .env (ในเครื่อง) " +
    "หรือ Environment Variables (บน Vercel) ว่ากรอกค่าไว้ครบหรือยัง"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
