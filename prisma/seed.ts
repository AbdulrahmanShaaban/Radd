import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";
import {
  DEMO_CLINIC_NAME,
  DEMO_CLINIC_SLUG,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_USER_NAME,
} from "../src/lib/demo";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestDocument } from "../src/lib/rag/ingest";

const hours = (from: number, fromMin: number, to: number, toMin: number) => {
  const base = new Date();
  base.setSeconds(0, 0);
  const start = new Date(base);
  start.setHours(from, fromMin);
  if (start.getTime() < base.getTime()) start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setHours(to, toMin);
  return { startsAt: start, endsAt: end };
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    await db.clinic.deleteMany({ where: { slug: DEMO_CLINIC_SLUG } });
    await db.evalCase.deleteMany();

    const clinic = await db.clinic.create({
      data: {
        name: DEMO_CLINIC_NAME,
        slug: DEMO_CLINIC_SLUG,
        locale: "ar",
      },
    });

    const ownerHash = await hashPassword(DEMO_PASSWORD);
    const staffHash = await hashPassword(DEMO_PASSWORD);

    await db.user.createMany({
      data: [
        {
          clinicId: clinic.id,
          email: DEMO_EMAIL,
          name: DEMO_USER_NAME,
          passwordHash: ownerHash,
          role: "OWNER",
        },
        {
          clinicId: clinic.id,
          email: "reception@radd.app",
          name: "سارة - الاستقبال",
          passwordHash: staffHash,
          role: "RECEPTIONIST",
        },
      ],
    });

    const patients = await db.patient.createManyAndReturn({
      data: [
        ["أحمد محمد", "01001112233"],
        ["منى عبد الله", "01004445566"],
        ["خالد سعيد", "01007778899"],
        ["فاطمة حسن", "01112223344"],
        ["يوسف علي", "01223334455"],
        ["نورهان إبراهيم", "01556667788"],
      ].map(([name, phone]) => ({
        clinicId: clinic.id,
        name,
        phone,
      })),
    });
    const [ahmed, mona, khaled, fatma, youssef, nourhan] = patients;

    const conversationSeeds = [
      {
        patient: ahmed,
        channel: "SIMULATOR" as const,
        state: "AI" as const,
        messages: [
          ["USER", "سلام، عايز أعرف الكشف الأولي بكم؟"],
          [
            "AI",
            "أهلاً أحمد 👋 الكشف الأولي عندنا 300 جنيه، والمتابعة 200 جنيه. تحب أحجز لك موعد؟",
          ],
          ["USER", "أيوه، بكرة الصباح مناسب؟"],
          [
            "AI",
            "بكرة فيه مواعيد من 10 الصبح لـ 12 ظهراً. أي واحدة تناسبك؟",
          ],
          ["USER", "11 تمام"],
          [
            "AI",
            "تمام ✅ اتحجزلك موعد بكرة الساعة 11 صباحاً. هنبعتلك رسالة تأكيد قبل الموعد بساعة."          ],
        ],
      },
      {
        patient: mona,
        channel: "WEB" as const,
        state: "HUMAN" as const,
        messages: [
          ["USER", "الدوام بتاعكم إيه؟ بكرة الجمعة؟"],
          [
            "AI",
            "أهلاً بيكِ 👋 دوامنا من السبت للخميس من 10 صباحاً لـ 8 مساءً، والجمعة إجازة.",
          ],
          ["USER", "طب تقدروا تعملوا خصم للطلاب؟"],
          [
            "SYSTEM",
            "تم تحويل المحادثة إلى موظف الاستقبال",
          ],
          ["HUMAN", "أهلاً مريم 👋 موجود خصم طلاب 15% على تنظيف الأسنان، هبعتلك التفاصيل."],
        ],
      },
      {
        patient: khaled,
        channel: "SIMULATOR" as const,
        state: "AI" as const,
        messages: [
          ["USER", "Where is the clinic located?"],
          ["AI", "We are at 12 El Nile St, Dokki, Giza. Free parking is available."],
          ["USER", "Do you accept Visa?"],
          ["AI", "Yes — cash, Visa, and Vodafone Cash are all accepted."],
        ],
      },
      {
        patient: fatma,
        channel: "INSTAGRAM" as const,
        state: "CLOSED" as const,
        messages: [
          ["USER", "عايزة أعرف تفاصيل تبييض الأسنان"],
          [
            "AI",
            "تبييض الأسنان عندنا 1200 جنيه وبيتم في جلسة واحدة حوالي ساعة، مع نتائج بتدوم من سنة لسنتين.",
          ],
          ["USER", "تمام شكراً"],
          ["AI", "عفوًا 😊 لو احتجتى أي حاجة ابعتيلنا في أي وقت."],
        ],
      },
      {
        patient: youssef,
        channel: "MESSENGER" as const,
        state: "AI" as const,
        messages: [
          ["USER", "إزاي ألغي الموعد بتاعي؟"],
          [
            "AI",
            "تقدر تلغي من غير رسوم لو قبلت بـ 3 ساعات على الأقل. تحب أحجزلك موعد تاني؟",
          ],
          ["USER", "أيوه بعد بكرة الظهر"],
          [
            "AI",
            "تمام ✅ اتحجز موعد بعد بكرة الساعة 2 ظهراً."          ],
        ],
      },
      {
        patient: nourhan,
        channel: "WEB" as const,
        state: "CLOSED" as const,
        messages: [
          ["USER", "فيه عيادة أسنان أطفال عندكم؟"],
          [
            "AI",
            "أهلاً 👋 أيوه، عندنا قسم أسنان أطفال بأسعار خاصة ومكالمات تحضيرية قبل الموعد عشان الطفل يتعود."          ],
          ["USER", "ممتاز 🙏"],
        ],
      },
    ];

    for (const seed of conversationSeeds) {
      await db.conversation.create({
        data: {
          clinicId: clinic.id,
          patientId: seed.patient.id,
          channel: seed.channel,
          state: seed.state,
          messages: {
            create: seed.messages.map(([author, content], idx) => ({
              clinicId: clinic.id,
              author: author as "USER" | "AI" | "HUMAN" | "SYSTEM",
              content,
              createdAt: new Date(Date.now() - (seed.messages.length - idx) * 5 * 60_000),
            })),
          },
        },
      });
    }

    const docs = [
      {
        title: "الخدمات والأسعار",
        chunks: [
          "الكشف الأولي: 300 جنيه. الكشف المتابعة: 200 جنيه.",
          "تنظيف الأسنان: 450 جنيه. تبييض الأسنان: 1200 جنيه في جلسة واحدة.",
          "تقويم الأسنان يبدأ من 8000 جنيه ويُقسَّط على 12 شهر.",
        ],
      },
      {
        title: "أوقات الدوام",
        chunks: [
          "الدوام من السبت إلى الخميس من 10 صباحاً حتى 8 مساءً.",
          "الجمعة إجازة رسمية. الطوارئ متاحة على مدار الساعة عبر رقم الطوارئ.",
        ],
      },
      {
        title: "الموقع والتواصل",
        chunks: [
          "العنوان: 12 شارع النيل، الدقي، الجيزة. يوجد موقف سيارات مجاني.",
          "الهاتف: 01000000000. واتساب: 01000000000. البريد: info@demo.clinic",
        ],
      },
      {
        title: "الأسئلة الشائعة",
        chunks: [
          "الدفع متاح كاش وفيزا وماستركارد وفودافون كاش.",
          "يمكن تأجيل أو إلغاء الموعد قبل 3 ساعات من موعده بدون أي رسوم.",
          "يوجد خصم طلاب 15% على خدمات تنظيف الأسنان عند إبراز كارت الطالب.",
        ],
      },
    ];

    for (const doc of docs) {
      await ingestDocument({
        clinicId: clinic.id,
        title: doc.title,
        text: doc.chunks.join("\n\n"),
        maxChars: 120,
      });
    }

    const appt1 = hours(11, 0, 11, 30);
    const appt2 = hours(14, 0, 14, 30);
    const appt3 = hours(16, 0, 16, 30);
    await db.appointment.createMany({
      data: [
        {
          clinicId: clinic.id,
          patientId: ahmed.id,
          kind: "كشف أولي",
          ...appt1,
        },
        {
          clinicId: clinic.id,
          patientId: youssef.id,
          kind: "متابعة",
          ...appt2,
        },
        {
          clinicId: clinic.id,
          patientId: nourhan.id,
          kind: "أسنان أطفال",
          ...appt3,
        },
      ],
    });

    await db.evalCase.createMany({
      data: [
        { question: "كم سعر الكشف الأولي؟", mustContain: ["300"] },
        { question: "إيه أوقات الدوام عندكم؟", mustContain: ["10"] },
        { question: "وين موقع العيادة؟", mustContain: ["الدقي"] },
        { question: "بتدفعوا إزاي؟", mustContain: ["فيزا"] },
        { question: "إزاي ألغي الموعد؟", mustContain: ["3 ساعات"] },
        {
          question: "What are your opening hours?",
          mustContain: ["Saturday"],
        },
      ],
    });

    console.log(`Seeded clinic "${DEMO_CLINIC_SLUG}" with demo data.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
