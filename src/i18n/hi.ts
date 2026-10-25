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
  "login.studentCodeHint": "जैसे 8B-R4TX। यह तुम्हें तुम्हारे शिक्षक देंगे।",
  "login.go": "शुरू करो",
  "login.wrong": "ये कोड नहीं मिले। अपने शिक्षक से जाँच लो।",
  // HINDI-REVIEW
  "login.tooMany": "बहुत बार गलत कोड लिखे गए। अपने शिक्षक से पूछो, या 10 मिनट बाद फिर कोशिश करो।",
  "login.logout": "समाप्त करो और लॉग आउट करो",
  "login.again": "कृपया अपने कोड फिर से लिखो।",
  "login.againLink": "मेरे कोड लिखो",

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
  "practise.answerHint": "तुम 5/3 जैसी भिन्न या -4 जैसी ऋणात्मक संख्या लिख सकते हो।",
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
  "practise.checkLine": "पंक्ति {n} को फिर से जाँचो।",
  // HINDI-REVIEW
  "practise.checkLine.detail": "पंक्ति 1 प्रश्न है। अपने हल की पंक्तियाँ वहीं से गिनो।",

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
  // HINDI-REVIEW (3 lines)
  "prove.noAiHelp": "परीक्षा के अंदर AI की कोई मदद नहीं।",
  "prove.teacherOpens": "यह तभी खुलती है जब तुम्हारे शिक्षक इसे कक्षा में खोलते हैं।",
  "prove.windowClosed": "तुम्हारे शिक्षक परीक्षा कक्षा में खोलेंगे।",
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

  // "हमने कैसे जाँचा" (receipts)
  // HINDI-REVIEW (all receipt lines below, new)
  "receipt.title": "हमने कैसे जाँचा",
  "receipt.putBack": "x = {x} को वापस समीकरण में रखो:",
  "receipt.left": "बायाँ पक्ष:",
  "receipt.right": "दायाँ पक्ष:",
  "receipt.holds": "दोनों पक्ष {value} हैं, इसलिए यह सही है।",
  "receipt.notHolds": "बायाँ पक्ष {left} है, दायाँ पक्ष {right} है, इसलिए यह अभी सही नहीं है।",
  "receipt.rule.same-signs": "चिह्न एक जैसे हैं: आकार जोड़ो और वही चिह्न रखो।",
  "receipt.rule.different-signs": "चिह्न अलग हैं: बड़े आकार में से छोटा आकार घटाओ, और बड़े आकार वाली संख्या का चिह्न लगाओ।",
  "receipt.integer.answer": "तुम्हारा उत्तर: {expr} = {value}",
  "receipt.integer.check": "जाँच: अपने उत्तर में से दूसरी संख्या घटाओ।",
  "receipt.integer.holds": "हमें फिर से पहली संख्या {start} मिलती है, इसलिए यह सही है।",
  "receipt.integer.notHolds": "हमें {back} मिलता है, {start} नहीं, इसलिए यह अभी सही नहीं है।",
  "receipt.collect.x": "x वाले पद जोड़ो:",
  "receipt.collect.numbers": "संख्याएँ जोड़ो:",
  "receipt.collect.result": "इसलिए सबसे सरल रूप {result} है।",
  "receipt.compare.putIn": "प्रश्न में और अपने उत्तर में x = {x} रखो:",
  "receipt.compare.question": "प्रश्न:",
  "receipt.compare.answer": "तुम्हारा उत्तर:",
  "receipt.compare.holds": "दोनों से {value} मिलता है।",
  "receipt.compare.notHolds": "प्रश्न से {q} मिलता है, तुम्हारे उत्तर से {a}, इसलिए यह अभी सही नहीं है।",
  "receipt.line.solution": "तुम्हारी पंक्ति से {solution} मिलता है। पंक्ति {n} में x = {x} रखो:",
  "receipt.line.same": "पंक्ति {n} के दोनों पक्ष {value} हैं, इसलिए तुम्हारी पंक्ति का हल वही है जो पंक्ति {n} का है।",
  "receipt.line.notSame": "बायाँ पक्ष {left} है, दायाँ पक्ष {right} है, इसलिए तुम्हारी पंक्ति का हल पंक्ति {n} के हल जैसा नहीं है।",
  "receipt.line.noSolution": "तुम्हारी पंक्ति से x का कोई एक मान नहीं मिलता, इसलिए इसका हल पंक्ति {n} के हल जैसा नहीं है।",
  "receipt.line.putIn": "पंक्ति {n} में और अपनी पंक्ति में x = {x} रखो:",
  "receipt.line.above": "पंक्ति {n}:",
  "receipt.line.yours": "तुम्हारी पंक्ति:",
  "receipt.line.sameValue": "दोनों से {value} मिलता है: तुम्हारी पंक्ति का मान वही है जो पंक्ति {n} का है।",
  "receipt.line.notSameValue": "पंक्ति {n} से {above} मिलता है, तुम्हारी पंक्ति से {line}, इसलिए दोनों का मान एक जैसा नहीं है।",
  "receipt.line.sumSame": "तुम्हारी पंक्ति का मान वही है जो पंक्ति {n} का है: {value}।",
  "receipt.line.sumNotSame": "तुम्हारी पंक्ति का मान पंक्ति {n} के मान जैसा नहीं है।",
  "prove.receipts": "हमने हर उत्तर को कैसे जाँचा",
  "prove.notAnswered": "समय पर उत्तर नहीं दिया गया।",

  "common.back": "अपने कौशलों पर वापस जाओ",
  "common.error": "कुछ गलत हो गया। कृपया फिर से कोशिश करो।",
  "common.locked": "यह कौशल बंद है। अपने शिक्षक से कहो।",
  "common.notFound": "वह पेज नहीं मिला।",
  "common.loading": "लोड हो रहा है…",
  "keypad.label": "गणित कीपैड", // HINDI-REVIEW
  "keypad.minus": "घटा",
  "keypad.plus": "जोड़",
  "keypad.equals": "बराबर",
  "keypad.divide": "भाग",
  "keypad.delete": "मिटाओ", // HINDI-REVIEW
  "keypad.clear": "सब मिटाओ", // HINDI-REVIEW
  "setup.missing": "शिष्य अभी तैयार नहीं है: सर्वर में एक सेटिंग नहीं है। अपने शिक्षक को बताओ।",

  // HINDI-REVIEW (the teacher's stuck board, all lines below)
  "board.patterns.none": "अभी कोई गलती का पैटर्न नहीं है। पैटर्न का मतलब है 2 अलग-अलग प्रश्नों पर एक ही गलती।",
  "board.patterns.evidence": "{n} प्रश्नों पर एक ही चरण",
  "board.unknown.evidence": "{n} प्रश्नों पर गलत",
  "board.slips.title": "एक चूक, नज़र रखें",
  "board.slips.intro": "इन बच्चों की एक जानी-पहचानी गलती केवल एक प्रश्न पर मिली। एक बार की गलती लापरवाही की चूक हो सकती है, इसलिए वे अभी किसी समूह में नहीं हैं।",
  "board.slips.at": "{code} पंक्ति {n} पर",
  "board.grid.title": "पैटर्न पहली बार कहाँ गलत होते हैं",
  "board.grid.intro": "हल की हर पंक्ति पर कितने बच्चों का पैटर्न पहली बार गलत होता है (L1 प्रश्न है)। एक बार की चूक नहीं गिनी जाती।",
  "board.grid.skill": "कौशल",
  "board.grid.line": "L{n}",

  // HINDI-REVIEW (proof window and new codes on the teacher board, all lines below)
  "board.proofs.title": "परीक्षाएँ",
  "board.proofs.open": "15 मिनट के लिए परीक्षा खोलें",
  "board.proofs.close": "अभी परीक्षा बंद करें",
  "board.proofs.openFor": "परीक्षा खुली है: {min} मिनट बचे हैं।",
  "board.proofs.closed": "परीक्षा बंद है। बच्चे अभ्यास कर सकते हैं और शिष्य को सिखा सकते हैं, पर परीक्षा शुरू नहीं कर सकते।",
  "board.proofs.started": "जो परीक्षा शुरू हो चुकी है, उसे अपने पूरे 30 मिनट मिलते हैं, परीक्षा बंद होने के बाद भी।",
  "board.proofs.always": "यह कक्षा परीक्षा-समय की सुविधा से पहले बनी थी, इसलिए बच्चे कभी भी परीक्षा शुरू कर सकते हैं।",
  "board.codes.give": "नए कोड दें",
  "board.codes.confirm": "हर बच्चे को नया कोड मिलेगा, और पुराने कोड तुरंत काम करना बंद कर देंगे। उनकी प्रगति बनी रहेगी।",
  "board.codes.yes": "हाँ, नए कोड दें",
  "board.codes.cancel": "रद्द करें",
  "board.codes.done": "नए कोड तैयार हैं। इन्हें छापकर बाँट दें: पुराने कोड अब काम नहीं करते।",
  // HINDI-REVIEW
  "board.export.impact": "असर के आँकड़ों में केवल असली कक्षाएँ गिनी जाती हैं। जाँच वाली और टूर वाली कक्षाएँ कभी नहीं गिनी जातीं।",

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
  "answer.format": "अपना उत्तर संख्या के रूप में लिखो, जैसे 5, -3, 5/3 या x = 5।",
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
  // UI
  "practise.answerHint.expression": "सबसे सरल रूप लिखो, जैसे 2x + 7 या 3x - 4।",

  // skills: titles, examples, tasks, answer labels
  "skill.alg.integers.ops.title": "पूर्णांकों का जोड़ और घटाव",
  "skill.alg.integers.ops.example": "जैसे −7 + 3 और 5 − (−4)",
  "skill.alg.integers.ops.task": "हल करो:",
  "skill.alg.integers.ops.answerLabel": "उत्तर:",
  "skill.alg.like-terms.title": "समान पद",
  "skill.alg.like-terms.example": "जैसे 3x + 5 − x + 2 = 2x + 7",
  "skill.alg.like-terms.task": "सरल करो:",
  "skill.alg.like-terms.answerLabel": "सबसे सरल रूप:",
  "skill.alg.linear.one-step.title": "एक चरण वाले समीकरण",
  "skill.alg.linear.one-step.example": "जैसे x + 7 = 3 और 4x = −12",
  "skill.alg.linear.one-step.task": "x का मान ज्ञात करो।",
  "skill.alg.linear.one-step.answerLabel": "x =",
  "skill.alg.linear.two-step.title": "दो चरण वाले समीकरण",
  "skill.alg.linear.two-step.example": "जैसे 5x − 3 = −8",
  "skill.alg.linear.two-step.task": "x का मान ज्ञात करो।",
  "skill.alg.linear.two-step.answerLabel": "x =",
  "skill.alg.linear.both-sides.task": "x का मान ज्ञात करो।",
  "skill.alg.linear.both-sides.answerLabel": "x =",

  // src/core line messages
  "teach.fix.sameValue": "इस पंक्ति का मान प्रश्न के बराबर नहीं है। हर चिह्न और हर संख्या जाँचो।",
  "teach.fix.sameExpr": "यह पंक्ति प्रश्न के बराबर नहीं है। समान पदों को आपस में जोड़ो, और हर पद को उसके चिह्न के साथ रखो।",
  "teach.fix.noProgress": "यह ऊपर वाली पंक्ति जैसी ही है। अगला चरण लिखो।",
  "teach.fix.oneNumber": "आखिरी पंक्ति में केवल एक संख्या लिखो।",
  "teach.fix.simplest": "आखिरी पंक्ति में सबसे सरल रूप लिखो: एक x वाला पद और एक संख्या।",
  "teach.fix.xEquals": "आखिरी पंक्ति में x = कोई संख्या लिखो।",
  "parse.extraEquals": "यहाँ केवल व्यंजक लिखो, बराबर के चिह्न (=) के बिना।",
  "parse.arith": "केवल पूर्ण संख्याएँ, कोष्ठक, + और − का उपयोग करो।",

  // alg.integers.ops
  "hint.alg.integers.ops.1": "शुरू करने से पहले हर संख्या का चिह्न देखो।",
  "hint.alg.integers.ops.2": "किसी पूर्णांक को घटाने के लिए उसका योज्य प्रतिलोम जोड़ो: a − (−n) वही है जो a + n है, और a − n वही है जो a + (−n) है।",
  "hint.alg.integers.ops.3": "अगर दोनों पूर्णांकों का चिह्न एक जैसा है, तो उनके आकार जोड़ो और वही चिह्न रखो। अगर चिह्न अलग हैं, तो बड़े आकार में से छोटा आकार घटाओ, और बड़े आकार वाली संख्या का चिह्न लगाओ।",
  "hint.alg.integers.ops.4": "दूसरी संख्याओं वाले उदाहरण: −50 + 20 = −(50 − 20) = −30, और 35 − (−20) = 35 + 20 = 55।",
  "mistake.alg.integers.ops.ignores-sign":
    "तुमने आकार जोड़ दिए और ऋण चिह्न छोड़ दिए। जब चिह्न अलग हों, तो बड़े आकार में से छोटा आकार घटाओ, और बड़े आकार वाली संख्या का चिह्न लगाओ।",
  "mistake.alg.integers.ops.minus-negative-as-minus":
    "किसी ऋणात्मक संख्या को घटाना उसके प्रतिलोम को जोड़ने के बराबर है: 5 − (−4) = 5 + 4। पहले घटाव को जोड़ के रूप में लिखो।",
  "mistake.alg.integers.ops.sign-of-first":
    "तुमने उत्तर को पहली संख्या का चिह्न दे दिया। जब चिह्न अलग हों, तो उत्तर का चिह्न बड़े आकार वाली संख्या का होता है।",

  // alg.like-terms
  "hint.alg.like-terms.1": "समान पद पहचानो: x वाले पद आपस में समान पद हैं, और संख्याएँ आपस में समान पद हैं।",
  "hint.alg.like-terms.2": "समान पदों को पास-पास रखो। हर पद अपना चिह्न अपने साथ रखता है।",
  "hint.alg.like-terms.3": "x वाले पदों को आपस में और संख्याओं को आपस में जोड़ो। x वाला पद और संख्या असमान पद हैं, इसलिए वे अलग रहते हैं। x का अर्थ 1x है।",
  "hint.alg.like-terms.4": "y वाला एक उदाहरण: 5y + 9 − 2y + 3 = 5y − 2y + 9 + 3 = 3y + 12।",
  "mistake.alg.like-terms.added-all-together":
    "x वाले पद और संख्याएँ असमान पद हैं, इसलिए उन्हें आपस में जोड़ा नहीं जा सकता। x वाले पदों को आपस में, और संख्याओं को आपस में जोड़ो।",
  "mistake.alg.like-terms.dropped-sign": "हर पद का चिह्न उसका अपना है। समान पदों को साथ रखते समय ऋण चिह्न को उसके पद के साथ रखो।",
  "mistake.alg.like-terms.x-as-0x": "x का अर्थ 1x है, और −x का अर्थ −1x है। x वाले पद जोड़ते समय इसे भी गिनो।",

  // alg.linear.one-step
  "hint.alg.linear.one-step.1": "देखो x के साथ क्या किया गया है: कोई संख्या जोड़ी गई है, घटाई गई है, या x को किसी संख्या से गुणा किया गया है?",
  "hint.alg.linear.one-step.2": "उलटी संक्रिया से उसे हटाओ, और दोनों पक्षों पर एक ही संक्रिया करो ताकि वे बराबर रहें।",
  "hint.alg.linear.one-step.3":
    "अगर कोई संख्या जोड़ी गई है, तो उसे दोनों पक्षों में से घटाओ। अगर घटाई गई है, तो दोनों पक्षों में जोड़ो। अगर x को किसी संख्या से गुणा किया गया है, तो दोनों पक्षों को उस संख्या से भाग दो।",
  "hint.alg.linear.one-step.4": "y वाले उदाहरण: y + 15 = 4 से y + 15 − 15 = 4 − 15, इसलिए y = −11। और 6y = 42 से y = 42 ÷ 6 = 7।",
  "mistake.alg.linear.one-step.same-operation":
    "किसी संख्या को हटाने के लिए दोनों पक्षों पर उलटी संक्रिया करो: जोड़ी गई संख्या को घटाकर, घटाई गई संख्या को जोड़कर, और गुणा करने वाली संख्या से भाग देकर हटाओ।",
  "mistake.alg.linear.one-step.divided-wrong-way":
    "दोनों पक्षों को x के साथ वाली संख्या से भाग दो। 4x = −12 में x = −12 ÷ 4: x के साथ वाली संख्या नीचे आती है।",
  "mistake.alg.linear.one-step.sign-error": "अपने उत्तर का चिह्न जाँचो: उसे प्रश्न में रखो, दोनों पक्ष बराबर आने चाहिए।",

  // alg.linear.two-step
  "hint.alg.linear.two-step.1": "x के साथ दो काम किए गए हैं: उसे किसी संख्या से गुणा किया गया है, और फिर कोई संख्या जोड़ी या घटाई गई है।",
  "hint.alg.linear.two-step.2": "उन्हें उलटे क्रम में हटाओ, और हर बार दोनों पक्षों पर एक ही संक्रिया करो।",
  "hint.alg.linear.two-step.3": "पहले दोनों पक्षों में जोड़कर या घटाकर x वाले पद के साथ वाली संख्या हटाओ। फिर दोनों पक्षों को x के साथ वाली संख्या से भाग दो।",
  "hint.alg.linear.two-step.4": "y वाला एक उदाहरण: 3y + 4 = 25 से 3y = 25 − 4 = 21, इसलिए y = 21 ÷ 3 = 7।",
  "mistake.alg.linear.two-step.divided-first":
    "पहले दोनों पक्षों पर उलटी संक्रिया करके x वाले पद के साथ वाली संख्या हटाओ। उसके बाद ही दोनों पक्षों को x के साथ वाली संख्या से भाग दो।",
  "mistake.alg.linear.two-step.kept-const-sign":
    "किसी पक्ष से कोई संख्या हटाने के लिए दोनों पक्षों पर उलटी संक्रिया करो। − 3 हटाने के लिए दोनों पक्षों में 3 जोड़ो। + 3 हटाने के लिए दोनों पक्षों में से 3 घटाओ।",
  "mistake.alg.linear.two-step.forgot-to-divide":
    "यह पंक्ति अभी भी बताती है कि कोई संख्या गुणा x कितना है। x का मान पाने के लिए दोनों पक्षों को x के साथ वाली संख्या से भाग दो।",
};
