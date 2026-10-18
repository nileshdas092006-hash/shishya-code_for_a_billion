// Hindi translation of src/i18n/en.ts (same keys; a test checks this).
// Words follow the NCERT Hindi textbook: समीकरण (equation), पक्ष (side), पद (term), संक्रिया (operation),
// "दोनों पक्षों पर एक ही संक्रिया करें" (do the same operation on both sides).
// To be checked by a Hindi-medium maths teacher before children see it.

export const hi: Record<string, string> = {
  "app.name": "शिष्य",
  "app.isProgram": "शिष्य एक कंप्यूटर प्रोग्राम है, कोई व्यक्ति नहीं।",
  "app.demo": "डेमो: केवल अभ्यास का डेटा, असली पायलट डेटा नहीं",

  "home.title": "शिष्य का उपयोग कौन कर रहा है?",
  "home.student": "मैं विद्यार्थी हूँ",
  "home.teacher": "मैं शिक्षक हूँ",

  "login.title": "नमस्ते! अपने कोड लिखो",
  "login.classCode": "कक्षा कोड",
  "login.classCodeHint": "तुम्हारे शिक्षक इसे बोर्ड पर लिखेंगे, जैसे 8B-K7QM।",
  "login.studentCode": "तुम्हारा कोड",
  "login.studentCodeHint": "जैसे 8B-17। यह तुम्हें तुम्हारे शिक्षक देंगे।",
  "login.go": "शुरू करो",
  "login.wrong": "ये कोड नहीं मिले। अपने शिक्षक से जाँच लो।",
  "login.logout": "समाप्त करो और लॉग आउट करो",

  "map.title": "तुम्हारे कौशल",
  "map.state.LOCKED": "बंद",
  "map.state.OPEN": "खुला",
  "map.state.KEY1": "चाबी 1 मिली",
  "map.state.NOT_YET": "अभी नहीं",
  "map.state.MASTERED": "महारत हासिल",
  "map.locked": "यह कौशल खोलने के लिए अपने शिक्षक से कहो।",
  "map.practise": "अभ्यास करो",
  "map.teach": "शिष्य को सिखाओ",
  "map.prove": "साबित करो",

  "practise.title": "अभ्यास",
  "practise.solve": "x का मान ज्ञात करो।",
  "practise.answerLabel": "x =",
  "practise.answerHint": "तुम 5/3 जैसी भिन्न या −4 जैसी ऋणात्मक संख्या लिख सकते हो।",
  "practise.check": "मेरा उत्तर जाँचो",
  "practise.next": "अगला प्रश्न",
  "practise.correct": "सही! तुम्हारे उत्तर से दोनों पक्ष बराबर हैं।",
  "practise.wrongKnown": "पूरी तरह सही नहीं। इस चरण को देखो:",
  "practise.wrongUnknown": "पूरी तरह सही नहीं। चलो इसे चरण-दर-चरण देखते हैं।",
  "practise.hint": "संकेत दिखाओ",
  "practise.hintLevel": "संकेत {n} / 4",
  "practise.noMoreHints": "यह आखिरी संकेत था।",
  "practise.streak": "लगातार सही: {n}",
  "practise.offerTeach": "बहुत बढ़िया! लगातार 5 सही। क्या तुम शिष्य को सिखाने के लिए तैयार हो?",
  "practise.loading": "प्रश्न आ रहा है…",

  "teach.title": "शिष्य को सिखाओ",
  "teach.start": "सिखाना शुरू करो",
  "teach.intro": "शिष्य ने यह प्रश्न हल करने की कोशिश की। उस पहली पंक्ति पर टैप करो जहाँ शिष्य से गलती हुई।",
  "teach.question": "प्रश्न",
  "teach.line": "पंक्ति {n}",
  "teach.tapped": "तुमने पंक्ति {n} चुनी। अब लिखो कि पंक्ति {n} क्या होनी चाहिए।",
  "teach.typeLabel": "सही पंक्ति {n}",
  "teach.typeHint": "संख्याएँ, x, +, − और = का उपयोग करो।",
  "teach.check": "मेरी पंक्ति जाँचो",
  "teach.triesLeft": "बचे हुए प्रयास: {n}",
  "teach.noTries": "इसके लिए प्रयास खत्म हो गए। चलो अगले प्रश्न पर चलते हैं।",
  "teach.next": "अगला",
  "teach.progress": "{total} में से {n} ठीक किए",
  "teach.done.key1": "तुम्हें चाबी 1 मिल गई! अब तुम इसे साबित कर सकते हो।",
  "teach.done.again": "अच्छी कोशिश! थोड़ा और अभ्यास करो, फिर शिष्य को दोबारा सिखाओ।",
  "teach.done.thanks": "शिष्य को सिखाने के लिए धन्यवाद!",
  "teach.shishya.confused": "हम्म… मुझसे गलती कहाँ हुई?",
  "teach.shishya.thinking": "मुझे तुम्हारी पंक्ति के बारे में सोचने दो…",
  "teach.shishya.happy": "अच्छा, अब मैं समझ गया! धन्यवाद!",

  "prove.title": "साबित करो",
  "prove.aiOff": "AI बंद है",
  "prove.rules": "तुम्हारी अपनी संख्याओं वाले 4 प्रश्न: 3 समीकरण और 1 शाब्दिक प्रश्न। कोई संकेत नहीं। तुम्हारे पास 30 मिनट हैं।",
  "prove.start": "परीक्षा शुरू करो",
  "prove.continue": "अपनी परीक्षा जारी रखो",
  "prove.question": "प्रश्न {n} / {total}",
  "prove.wordProblem": "शाब्दिक प्रश्न",
  "prove.submit": "मेरा उत्तर सहेजो",
  "prove.timeLeft": "बचा हुआ समय: {min} मिनट",
  "prove.mastered": "महारत हासिल! तुमने यह कौशल साबित कर दिया।",
  "prove.nextUnlocked": "अगला कौशल खुल गया: {skill}",
  "prove.notYet": "अभी नहीं। इनका अभ्यास करो:",
  "prove.practiseStepByStep": "समीकरण चरण-दर-चरण हल करो, और हर पंक्ति जाँचो।",
  "prove.retryAt": "तुम्हारी अगली परीक्षा {time} पर खुलेगी।",
  "prove.notReady": "पहले शिष्य को सिखाकर चाबी 1 पाओ।",
  "prove.alreadyMastered": "तुम इस कौशल में पहले ही महारत हासिल कर चुके हो।",
  "prove.running": "तुम्हारी परीक्षा पहले से किसी दूसरी स्क्रीन पर खुली है।",

  "project.title": "कक्षा मोड: मिलकर शिष्य को सिखाओ",
  "project.instructions": "कक्षा: पहली गलती किस पंक्ति में है? फिर, वह पंक्ति क्या होनी चाहिए?",
  "project.typeFix": "कक्षा की पंक्ति",
  "project.newTrace": "नया प्रश्न",
  "project.check": "जाँचो",

  "common.back": "अपने कौशलों पर वापस जाओ",
  "common.error": "कुछ गलत हो गया। कृपया फिर से कोशिश करो।",
  "common.locked": "यह कौशल बंद है। अपने शिक्षक से कहो।",
  "common.notFound": "वह पेज नहीं मिला।",

  "skill.alg.linear.both-sides.title": "दोनों पक्षों में x",
  "skill.alg.linear.both-sides.example": "जैसे 4x − 3 = 2x + 7",

  // src/core teach messages
  "teach.fix.ok": "बहुत बढ़िया! तुमने शिष्य की गलती ढूँढकर ठीक कर दी। दोनों पक्ष अब भी बराबर हैं।",
  "teach.fix.notEqual":
    "इस पंक्ति में दोनों पक्ष प्रश्न के बराबर नहीं रहते। एक पक्ष पर जो करो, दूसरे पक्ष पर भी वही संक्रिया करो।",
  "teach.fix.shape.2":
    "दोनों पक्ष अब भी बराबर हैं, पर दाएँ पक्ष में अभी भी x वाला पद है। दोनों पक्षों पर एक ही संक्रिया करके उसे हटाओ।",
  "teach.fix.shape.3": "दोनों पक्ष अब भी बराबर हैं। अब बाएँ पक्ष में केवल x वाले पद और दाएँ पक्ष में केवल संख्याएँ रखो।",
  "teach.fix.shape.4": "दोनों पक्ष अब भी बराबर हैं। अब x वाले पदों को मिलाकर एक पद और संख्याओं को मिलाकर एक संख्या बनाओ।",
  "teach.fix.shape.5": "दोनों पक्ष अब भी बराबर हैं। अब दोनों पक्षों को x के साथ वाली संख्या से भाग दो, ताकि बायाँ पक्ष केवल x रहे।",
  "teach.tap.tooEarly": "पंक्ति {line} सही है। नीचे देखो कि पहली गलती कहाँ है।",
  "teach.tap.tooLate": "पंक्ति {line} से पहले ही कुछ गलत हो गया है। ऊपर की पंक्तियाँ एक-एक करके जाँचो।",

  // src/core parse messages
  "parse.empty": "पहले एक पंक्ति लिखो।",
  "parse.noEquals": "समीकरण में बराबर का चिह्न (=) होना चाहिए।",
  "parse.manyEquals": "बराबर का चिह्न (=) केवल एक बार लिखो।",
  "parse.sideMissing": "= चिह्न के एक तरफ कुछ छूट गया है।",
  "parse.needSign": "दो पदों के बीच + या − चिह्न लगाओ।",
  "parse.signNeedsTerm": "+ या − चिह्न के बाद कोई संख्या या x होना चाहिए।",
  "parse.decimals": "केवल पूर्ण संख्याएँ लिखो, दशमलव नहीं।",
  "parse.brackets": "यहाँ कोष्ठक की ज़रूरत नहीं है। पंक्ति बिना कोष्ठक के लिखो।",
  "parse.fractions": "केवल पूर्ण संख्याएँ लिखो, भिन्न नहीं।",
  "parse.unreadable": 'मैं "{ch}" नहीं पढ़ पाया। केवल संख्याएँ, x, +, − और = का उपयोग करो।',
  "parse.tooBig": "यह संख्या बहुत बड़ी है। पंक्ति फिर से जाँचो।",
  "parse.generic": "मैं वह पंक्ति नहीं पढ़ पाया। जाँचकर फिर से कोशिश करो।",

  // src/core answer messages
  "answer.format": "अपना उत्तर संख्या के रूप में लिखो, जैसे 5, −3 या 5/3।",
  "answer.zeroDen": "भिन्न में नीचे की संख्या 0 नहीं हो सकती।",

  // alg.linear.both-sides: hints
  "hint.alg.linear.both-sides.1": "समीकरण के दोनों पक्षों को देखो। अज्ञात x बाएँ पक्ष में भी है और दाएँ पक्ष में भी।",
  "hint.alg.linear.both-sides.2":
    "सभी x वाले पद एक पक्ष में और सभी संख्याएँ दूसरे पक्ष में लाओ। एक पक्ष पर जो करो, दूसरे पक्ष पर भी वही संक्रिया करो, ताकि दोनों पक्ष बराबर रहें।",
  "hint.alg.linear.both-sides.3":
    "पहले दोनों पक्षों पर उलटी संक्रिया करके दाएँ पक्ष से x वाला पद हटाओ। फिर इसी तरह x वाले पद के साथ वाली संख्या हटाओ। अंत में दोनों पक्षों को x के साथ वाली संख्या से भाग दो।",
  "hint.alg.linear.both-sides.4":
    "दूसरी संख्याओं वाला एक उदाहरण: 3x + 1 = x + 31। दोनों पक्षों में से x घटाओ: 2x + 1 = 31। दोनों पक्षों में से 1 घटाओ: 2x = 30। दोनों पक्षों को 2 से भाग दो: x = 15।",

  // alg.linear.both-sides: mistakes
  "mistake.alg.linear.both-sides.kept-x-sign":
    "दाएँ पक्ष से x वाला पद हटाने के लिए दोनों पक्षों पर एक ही संक्रिया करो: दोनों पक्षों में से उसे घटाओ। यहाँ उसे बाएँ पक्ष में जोड़ दिया गया।",
  "mistake.alg.linear.both-sides.dropped-constant":
    "x वाले पद के साथ वाली संख्या छूट गई। उसे बाएँ पक्ष से हटाने के लिए दोनों पक्षों पर उलटी संक्रिया करो। उसे यूँ ही छोड़ा नहीं जा सकता।",
  "mistake.alg.linear.both-sides.kept-const-sign":
    "किसी पक्ष से कोई संख्या हटाने के लिए दोनों पक्षों पर उलटी संक्रिया करो। − 3 हटाने के लिए दोनों पक्षों में 3 जोड़ो। + 3 हटाने के लिए दोनों पक्षों में से 3 घटाओ।",
  "mistake.alg.linear.both-sides.forgot-to-divide":
    "यह पंक्ति अभी भी बताती है कि कोई संख्या गुणा x कितना है। x का मान पाने के लिए दोनों पक्षों को x के साथ वाली संख्या से भाग दो।",
};
