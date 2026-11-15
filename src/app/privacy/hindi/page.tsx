import type { Metadata } from "next";
import Link from "next/link";
import { GRIEVANCE_OFFICER, POLICY_VERSION } from "@/lib/consent";

export const metadata: Metadata = {
  title: "गोपनीयता नीति — Forge",
  description:
    "Forge आपका कौन-सा व्यक्तिगत डेटा लेता है, क्यों लेता है, कितने समय तक रखता है और उसे मिटाने का तरीका — सरल हिंदी में।",
};

export default function PrivacyHindiPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-[17px] font-semibold tracking-tight text-primary">
            Forge
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              English
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              नियम
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          नीति संस्करण {POLICY_VERSION}
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-foreground">
          गोपनीयता नीति
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          यह नीति सरल हिंदी में बताती है कि Forge आपका कौन-सा व्यक्तिगत डेटा लेता है, क्यों लेता है, कितने समय
          तक रखता है, और आप उसे कैसे देख, सुधार या मिटा सकते हैं। यह भारत के डिजिटल व्यक्तिगत डेटा संरक्षण
          अधिनियम, 2023 (DPDP Act) के अनुसार लिखी गई है। कानूनी रूप से बाध्यकारी संस्करण अंग्रेज़ी में है; यह
          हिंदी अनुवाद आपकी सुविधा के लिए है।
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">1. हम कौन हैं</h2>
            <p className="mt-3">
              Forge एक दैनिक कौशल-अभ्यास उत्पाद है। DPDP अधिनियम के अर्थ में Forge &ldquo;डेटा फ़िड्यूशियरी&rdquo;
              है — अर्थात हम तय करते हैं कि आपका व्यक्तिगत डेटा क्यों और कैसे संसाधित होगा। हमारे शिकायत
              अधिकारी का विवरण इस पृष्ठ के अंत में है।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">2. हम क्या जमा करते हैं</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">ईमेल पता</span> — लॉगिन, खाता रिकवरी और कानूनी
                सूचनाओं के लिए। खाता हटाने पर हटा दिया जाता है।
              </li>
              <li>
                <span className="font-medium text-foreground">नाम और प्रोफ़ाइल विवरण</span> — जो आप स्वयं भरते
                हैं, ताकि आपकी रिकॉर्ड पहचानी जा सके।
              </li>
              <li>
                <span className="font-medium text-foreground">अभ्यास जमा, स्कोर, लगा समय, अभ्यास की तारीख</span> —
                समय-मुद्रित (time-stamped) रिकॉर्ड बनाने के लिए, जिसे भर्तीकर्ता सत्यापित कर सकें।
              </li>
              <li>
                <span className="font-medium text-foreground">स्ट्रीक और निरंतरता के आँकड़े</span> — आपके
                प्रयासों से बनाए जाते हैं।
              </li>
              <li>
                <span className="font-medium text-foreground">सहमति रिकॉर्ड</span> — कौन-सी सहमति, किस नीति
                संस्करण पर और कब दी गई। यह DPDP के तहत आवश्यक है।
              </li>
              <li>
                <span className="font-medium text-foreground">सुरक्षा लॉग</span> — क्रिया, समय और IP का
                एक-तरफ़ा हैश (मूल IP पता नहीं)। 24 महीने तक।
              </li>
            </ul>
            <p className="mt-4">
              हम आपका फ़ोन नंबर, पता, सरकारी पहचान पत्र या भुगतान विवरण नहीं लेते। हम आपका डेटा कभी बेचते
              नहीं और किसी विज्ञापन नेटवर्क के साथ साझा नहीं करते।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">3. सहमति</h2>
            <p className="mt-3">
              खाता बनाने के लिए आपका अभ्यास-रिकॉर्ड सहेजने की सहमति आवश्यक है, क्योंकि उसके बिना उत्पाद काम
              नहीं कर सकता। भर्तीकर्ताओं को दिखना और उत्पाद ईमेल — ये दोनों वैकल्पिक हैं, डिफ़ॉल्ट रूप से
              बंद हैं, और आप कभी भी सेटिंग्स में बंद कर सकते हैं। वैकल्पिक सहमति बंद करने पर आपकी रिकॉर्ड तक
              पहुँच खत्म नहीं होती।
            </p>
            <p className="mt-3">
              हम प्रत्येक उद्देश्य की सहमति अलग से, नीति संस्करण और समय के साथ दर्ज करते हैं।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">4. आपका डेटा कौन देख सकता है</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>आप — हमेशा, पूरे एक्सपोर्ट के साथ।</li>
              <li>
                भर्तीकर्ता — केवल तब जब आपने भर्तीकर्ता-खोज चालू की हो। वे आपका नाम, हेडलाइन, कौशल, स्कोर,
                स्ट्रीक और निरंतरता देखते हैं। आपका ईमेल कभी नहीं दिखता।
              </li>
              <li>
                हमारा प्रोसेसर — Supabase डेटाबेस और लॉगिन सेवा देता है। डेटा ट्रांज़िट में और स्टोरेज में
                एन्क्रिप्टेड रहता है।
              </li>
              <li>अधिकारी — केवल जब कानून बाध्य करे।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">5. सुरक्षा</h2>
            <p className="mt-3">
              पहुँच डेटाबेस स्तर पर नियंत्रित होती है (Row Level Security): हर क्वेरी केवल आपके अपने खाते तक
              सीमित रहती है। सर्वर हर बदलाव की जाँच करता है, और जमा किए गए अभ्यास बाद में बदले नहीं जा सकते।
            </p>
            <p className="mt-3">
              यदि कोई व्यक्तिगत डेटा उल्लंघन आपको प्रभावित करता है, तो हम भारत के डेटा संरक्षण बोर्ड और
              आपको सूचित करेंगे — क्या हुआ, कौन-सा डेटा प्रभावित हुआ, हमने क्या किया, और आप क्या कर सकते हैं।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              6. DPDP अधिनियम के तहत आपके अधिकार
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">देखने का अधिकार</span> — सेटिंग्स से पूरा डेटा
                JSON या CSV में डाउनलोड करें।
              </li>
              <li>
                <span className="font-medium text-foreground">सुधार का अधिकार</span> — प्रोफ़ाइल सीधे संपादित
                करें, या सुधार अनुरोध भेजें।
              </li>
              <li>
                <span className="font-medium text-foreground">मिटाने का अधिकार</span> — सेटिंग्स से खाता
                हटाएँ। डेटा लाइव डेटाबेस से, कैश से और बैकअप रोटेशन के अनुसार बैकअप से हट जाता है।
              </li>
              <li>
                <span className="font-medium text-foreground">सहमति वापस लेने का अधिकार</span> — वैकल्पिक
                उद्देश्य सेटिंग्स में बंद करें।
              </li>
              <li>
                <span className="font-medium text-foreground">शिकायत का अधिकार</span> — सेटिंग्स से अनुरोध
                भेजें या शिकायत अधिकारी को ईमेल करें। हम 30 दिनों में उत्तर देते हैं।
              </li>
              <li>
                <span className="font-medium text-foreground">नामांकन का अधिकार</span> — मृत्यु या अक्षमता की
                स्थिति में अपने अधिकारों के प्रयोग के लिए किसी व्यक्ति को नामित कर सकते हैं।
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              7. खाता हटाने पर क्या रहता है
            </h2>
            <p className="mt-3">
              खाता हटाने पर प्रोफ़ाइल, अभ्यास, स्कोर, स्ट्रीक, सहमति रिकॉर्ड और भर्तीकर्ता के नोट्स हट जाते
              हैं। एक चीज़ जानबूझकर रखी जाती है: यह साबित करने के लिए कि हटाने का अनुरोध पूरा हुआ, एक
              एक-तरफ़ा हैश वाला रिकॉर्ड। उसमें नाम, ईमेल या अभ्यास डेटा नहीं होता। एन्क्रिप्टेड बैकअप अधिकतम
              30 दिनों में हट जाते हैं।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">8. बच्चे</h2>
            <p className="mt-3">
              Forge 18 वर्ष या उससे अधिक आयु के लोगों के लिए है। हम जानबूझकर बच्चों का डेटा संसाधित नहीं
              करते। यदि पता चलता है कि खाता किसी बच्चे का है, तो हम उसे हटा देते हैं।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">9. कुकीज़</h2>
            <p className="mt-3">
              केवल आवश्यक कुकीज़: लॉगिन बनाए रखने वाली सेशन कुकी और फ़ॉर्म सुरक्षा कुकी। कोई विज्ञापन या
              ट्रैकिंग कुकी नहीं — इसलिए कुकी बैनर की ज़रूरत नहीं।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              10. शिकायत अधिकारी और संपर्क
            </h2>
            <p className="mt-3">
              {GRIEVANCE_OFFICER.role}, {GRIEVANCE_OFFICER.region}. ईमेल{" "}
              <a
                href={`mailto:${GRIEVANCE_OFFICER.email}`}
                className="text-foreground underline underline-offset-4"
              >
                {GRIEVANCE_OFFICER.email}
              </a>
              . हम 7 दिनों में पुष्टि और {GRIEVANCE_OFFICER.responseWindowDays} दिनों में समाधान देते हैं।
              संतुष्ट न होने पर आप भारत के डेटा संरक्षण बोर्ड से शिकायत कर सकते हैं।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">11. बदलाव</h2>
            <p className="mt-3">
              यदि व्यक्तिगत डेटा के उपयोग में बदलाव होता है, तो हम नया नीति संस्करण प्रकाशित करते हैं और
              जहाँ आवश्यक हो, नई सहमति लेते हैं। आपने जो संस्करण स्वीकार किया, वह आपके खाते के साथ सुरक्षित
              रहता है।
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-card-border pt-6 text-sm">
          <Link href="/privacy" className="text-foreground underline underline-offset-4">
            Read in English
          </Link>
          <Link href="/settings" className="text-muted-foreground hover:text-foreground">
            अपना डेटा प्रबंधित करें
          </Link>
        </div>
      </main>
    </div>
  );
}
