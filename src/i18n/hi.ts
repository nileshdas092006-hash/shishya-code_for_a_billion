// Hindi translation of src/i18n/en.ts (same keys; a test checks this).
// Words follow the NCERT Hindi textbook: समीकरण (equation), पक्ष (side), पद (term), संक्रिया (operation),
// "दोनों पक्षों पर एक ही संक्रिया करें" (do the same operation on both sides).
// To be checked by a Hindi-medium maths teacher before children see it.

import { CHILD_MESSAGES_HI } from "../core/childMessages";

export const hi: Record<string, string> = {
  // a mined mistake's fixed child message (src/core/childMessages.ts; HINDI-REVIEW there)
  ...CHILD_MESSAGES_HI,
  "app.name": "शिष्य",
  "app.isProgram": "शिष्य एक कंप्यूटर प्रोग्राम है, कोई व्यक्ति नहीं।",
  "app.demo": "डेमो: केवल अभ्यास का डेटा, असली पायलट डेटा नहीं",

  "home.title": "शिष्य का उपयोग कौन कर रहा है?",
  "home.student": "मैं विद्यार्थी हूँ",
  "home.teacher": "मैं शिक्षक हूँ",
  // HINDI-REVIEW (the Judge Tour lines below, up to tour.agent.approveNote)
  "home.tour": "जज की तरह आज़माएँ (3 मिनट)",
  "home.tourNote": "एक बनावटी कक्षा, ताकि आप सब कुछ दबाकर देख सकें। 24 घंटे बाद मिटा दी जाती है।",

  "tour.busy": "अभी बहुत से जज शिष्य को आज़मा रहे हैं। कृपया कुछ मिनट बाद फिर कोशिश करें।",
  "tour.banner": "जज टूर · पड़ाव {n} / 6 · बनावटी कक्षा · 24 घंटे में मिट जाएगी",
  "tour.back": "पीछे",
  "tour.next": "आगे",
  "tour.toTeacher": "शिक्षक का दृश्य देखें",
  "tour.toChild": "बच्चे का दृश्य देखें",
  "tour.return": "जज टूर पर वापस जाएँ",
  "tour.ended": "यह टूर समाप्त हो गया है: टूर 24 घंटे बाद मिटा दिए जाते हैं। नया टूर शुरू करें।",
  "tour.stop.1": "बच्चा अभ्यास करता है",
  "tour.stop.2": "शिष्य को सिखाओ",
  "tour.stop.3": "अकेले करके दिखाओ (परीक्षा)",
  "tour.stop.4": "निपुण",
  "tour.stop.5": "शिक्षक का बोर्ड",
  "tour.stop.6": "एजेंट",
  "tour.tip.1": "जान-बूझकर एक गलत उत्तर देकर देखें।",
  "tour.tip.2": "वह पंक्ति दबाएँ जहाँ शिष्य से पहली गलती हुई, फिर सही पंक्ति लिखें। उसे धोखा देकर देखें: एक गलत पंक्ति लिखें और देखें क्या होता है।",
  "tour.tip.3": "हर बच्चे को अपनी अलग संख्याएँ मिलती हैं। अपनी परीक्षा की तुलना एक सहपाठी की परीक्षा से करें।",
  "tour.tip.4": "हर उत्तर के नीचे \"हमने कैसे जाँचा\" खोलें: कोड आपके उत्तर को वापस प्रश्न में रखता है।",
  "tour.tip.5": "पैटर्न का अर्थ है 2 अलग प्रश्नों पर एक ही गलती; एक बार मिलना केवल चूक है। आपका अपना बच्चा {code} है।",
  "tour.tip.6": "यह AI एजेंट का एक रिकॉर्ड किया हुआ रन है। इस पेज पर कुछ भी सहेजा नहीं जाता।",
  "tour.skip": "आगे बढ़ें (कक्षा में इसमें लगभग 20 मिनट लगते हैं)",
  "tour.skip.explain":
    "कक्षा में बच्चा परीक्षा से पहले शिष्य को 3 प्रश्न सिखाता है। यह बटन सही पंक्तियों से आपका सिखाना पूरा करता है, उन्हीं जाँचों से होकर, इसलिए \"शिष्य को सिखा दिया\" सामान्य नियम से ही मिलता है।", // HINDI-REVIEW
  "tour.classmate.title": "एक सहपाठी की परीक्षा",
  "tour.classmate.intro": "{code} को ये 4 प्रश्न मिले थे: आपसे अलग संख्याएँ।",
  "tour.mastered.none": "पहले पड़ाव 3 पर परीक्षा पूरी करें। फिर आपकी रसीदें यहाँ दिखेंगी।",
  "tour.agent.title": "गलती खोजने वाले (एक AI सहायक) ने एक नई गलती कैसे खोजी", // HINDI-REVIEW
  "tour.agent.recorded": "रिकॉर्ड किया हुआ रन, {date}, जाँच वाले उत्तरों पर",
  "tour.agent.input":
    "इसे क्या दिया गया: ऐसे गलत उत्तर जिन्हें कोई जानी हुई गलती नहीं समझाती थी। केवल हर प्रश्न की संख्याएँ और उत्तर: कोई कोड नहीं, कोई नाम नहीं।",
  "tour.agent.example": "{question} के लिए दर्ज उत्तर x = {answer} था।",
  "tour.agent.others": "दूसरे प्रश्नों पर पाँच और दर्ज उत्तर: {list}",
  "tour.agent.did": "AI ने क्या किया",
  "tour.agent.tool.get_unknown_errors": "बिना समझाए गलत उत्तर पढ़े",
  "tour.agent.tool.validate_mined_mistake": "एक गलती सुझाई और कोड से उसकी जाँच करवाई",
  "tour.agent.tool.submit_draft": "जाँचा हुआ मसौदा शिक्षक के लिए सहेजा",
  "tour.agent.calls": "{n} AI कॉल, लगभग {seconds} सेकंड ({model})",
  "tour.agent.proposal": "इसने यह गलती सुझाई: x = {formula}",
  "tour.agent.trace": "इस गलती के साथ शिष्य का हल ({correct} सही है):",
  "tour.agent.firstWrong": "← पहली गलत पंक्ति",
  "tour.agent.checks": "कोड से जाँचा गया: यह दर्ज उत्तरों में से {explained} को समझाती है, और {checked} नए प्रश्नों पर कभी सही उत्तर नहीं देती।",
  "tour.agent.advice": "जो कोड नहीं जाँच सकता: बच्चे के लिए AI का संदेश गलत था। उसने कहा: \"{quote}\"। यह बच्चे को गलती करना सिखाता है।",
  "tour.agent.why": "इसीलिए हर मसौदे को किसी भी कक्षा में इस्तेमाल होने से पहले शिक्षक को पढ़कर स्वीकार करना होता है।",
  "tour.agent.approve": "स्वीकार करें",
  "tour.agent.approveNote": "असली कक्षा में शिक्षक की स्वीकृति से यह गलती हर कक्षा के लिए जुड़ जाती है। टूर में कुछ भी सहेजा नहीं जाता।",

  // HINDI-REVIEW (the mistake finder's review card and run history, all lines below; teachers only)
  "review.childSees": "बच्चा यह देखेगा",
  "review.childSeesNote": "लोगों का लिखा एक तय संदेश, AI का नहीं। अगर आप इसे बदलते हैं, तो बच्चा आपके शब्द देखेगा।",
  "review.aiSuggestion": "AI का सुझाव (केवल आप देखते हैं)",
  "review.aiSuggestionNote": "बच्चे यह लेख कभी नहीं देखते।",
  "review.evidence.title": "दर्ज किए गए गलत उत्तर जिन्हें यह समझाती है",
  "review.evidence.question": "प्रश्न",
  "review.evidence.answer": "बच्चे का उत्तर",
  "review.evidence.predicted": "यह गलती देती है",
  "review.evidence.match": "समान?",
  "review.evidence.times": "कितनी बार",
  "review.evidence.none": "अभी दर्ज किया गया कोई गलत उत्तर इससे मेल नहीं खाता।",
  "review.checks.title": "कोड से जाँचा गया",
  "review.check.explains": "3 या अधिक असली उत्तर समझाती है (यह {n} समझाती है)",
  "review.check.neverRight": "{n} यादृच्छिक प्रश्नों में कभी सही उत्तर नहीं देती",
  "review.check.noDivideByZero": "{n} यादृच्छिक प्रश्नों में कभी शून्य से भाग नहीं देती",
  "review.check.different": "हर जानी हुई गलती से अलग है",
  "review.howAgent": "एजेंट ने कैसे काम किया",
  "agentRuns.title": "एजेंट ने कैसे काम किया",
  "agentRuns.intro":
    "गलती खोजने वाले (एक AI सहायक) के पिछले 10 रन। इसने केवल बिना नाम की संख्याएँ देखीं: हर प्रश्न की संख्याएँ और गलत उत्तर। यहाँ किसी बच्चे का कोई डेटा नहीं दिखाया जाता।",
  "agentRuns.none": "अभी कोई रन नहीं।",
  "agentRuns.recorded": "दर्ज किया गया रन: पिछले एक रन के हमारे स्थानीय रिकॉर्ड से, जाँच वाले उत्तरों पर",
  "agentRuns.meta": "{skill} · {turns} बारी · {model}",
  "agentRuns.noModel": "कोई AI कॉल नहीं",
  "agentRuns.proposals": "इसने क्या सुझाया, और कोड की जाँच ने क्या कहा:",
  "agentRuns.noProposals": "कोई सुझाव नहीं।",
  "agentRuns.back": "कक्षा बोर्ड पर वापस",
  "agentRuns.status.draft_saved": "शिक्षक की समीक्षा के लिए एक जाँचा हुआ मसौदा सहेजा",
  "agentRuns.status.no_draft": "कोई मसौदा नहीं: कोई सुझाव जाँच में पास नहीं हुआ",
  "agentRuns.status.not_enough_data": "पर्याप्त डेटा नहीं: 3 से कम बिना समझाए गलत उत्तर",
  "agentRuns.status.failed": "विफल: {error}",
  "agentRuns.status.other": "समाप्त: {status}",
  "agentRuns.verdict.accepted": "स्वीकार: {n} असली उत्तर समझाती है",
  "agentRuns.verdict.right": "अस्वीकार: {total} में से {n} प्रश्नों पर सही उत्तर देती है",
  "agentRuns.verdict.zero": "अस्वीकार: {total} में से {n} प्रश्नों पर शून्य से भाग देती है",
  "agentRuns.verdict.few": "अस्वीकार: केवल {n} असली उत्तर समझाती है (3 चाहिए)",
  "agentRuns.verdict.known": "अस्वीकार: {total} में से {n} प्रश्नों पर जानी हुई गलती \"{id}\" जैसा ही उत्तर देती है",
  "agentRuns.verdict.other": "अस्वीकार: {reason}",

  "login.title": "नमस्ते! अपने कोड लिखो",
  "login.classCode": "कक्षा कोड",
  "login.classCodeHint": "तुम्हारे शिक्षक इसे बोर्ड पर लिखेंगे, जैसे 8B-K7QM।",
  "login.studentCode": "तुम्हारा कोड",
  "login.studentCodeHint": "जैसे 8B-R4TX। यह तुम्हें तुम्हारे शिक्षक देंगे।",
  "login.go": "शुरू करो",
  "login.wrong": "ये कोड नहीं मिले। अपने शिक्षक से जाँच लो।",
  // HINDI-REVIEW
  "login.tooMany": "बहुत बार गलत कोड लिखे गए। अपने शिक्षक से पूछो, या 10 मिनट बाद फिर कोशिश करो।",
  // HINDI-REVIEW
  "login.consentNeeded": "तुम्हारे शिक्षक को अभी कक्षा की तैयारी पूरी करनी है।",
  "login.logout": "समाप्त करो और लॉग आउट करो",
  "login.again": "कृपया अपने कोड फिर से लिखो।",
  "login.againLink": "मेरे कोड लिखो",

  "map.title": "तुम्हारे कौशल",
  "map.state.LOCKED": "अभी शुरू नहीं हुआ", // HINDI-REVIEW
  "map.state.OPEN": "अभ्यास चल रहा है", // HINDI-REVIEW
  "map.state.KEY1": "शिष्य को सिखा दिया", // HINDI-REVIEW
  "map.state.NOT_YET": "अगली कोशिश कल खुलेगी", // HINDI-REVIEW
  "map.state.MASTERED": "महारत हासिल",
  "map.locked": "यह कौशल खोलने के लिए अपने शिक्षक से कहो।",
  "map.practise": "अभ्यास करो",
  "map.teach": "शिष्य को सिखाओ",
  "map.prove": "अकेले करके दिखाओ", // HINDI-REVIEW
  "map.nextTry.1": "अगली कोशिश अगले पीरियड में खुलेगी", // HINDI-REVIEW
  "map.nextTry.0": "अगली कोशिश अभी खुली है", // HINDI-REVIEW
  "map.nextTry.hours": "अगली कोशिश चूकी हुई परीक्षा के {h} घंटे बाद खुलेगी", // HINDI-REVIEW

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
  "teach.done.key1": "तुमने शिष्य को सिखा दिया! अब अकेले करके दिखाओ।", // HINDI-REVIEW
  "teach.done.again": "अच्छी कोशिश! थोड़ा और अभ्यास करो, फिर शिष्य को दोबारा सिखाओ।",
  "teach.done.thanks": "शिष्य को सिखाने के लिए धन्यवाद!",
  "teach.shishya.confused": "हम्म… मुझसे गलती कहाँ हुई?",
  "teach.shishya.thinking": "मुझे तुम्हारी पंक्ति के बारे में सोचने दो…",
  "teach.shishya.happy": "अच्छा, अब मैं समझ गया! धन्यवाद!",

  "prove.title": "अकेले करके दिखाओ", // HINDI-REVIEW
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
  "prove.mastered": "महारत हासिल! तुमने यह कौशल अकेले करके दिखा दिया।", // HINDI-REVIEW
  "prove.nextUnlocked": "अगला कौशल खुल गया: {skill}",
  "prove.notYet": "अगली कोशिश से पहले इनका अभ्यास करो:", // HINDI-REVIEW
  "prove.practiseStepByStep": "समीकरण चरण-दर-चरण हल करो, और हर पंक्ति जाँचो।",
  "prove.retryAt": "तुम्हारी अगली कोशिश {time} पर खुलेगी।", // HINDI-REVIEW
  "prove.notReady": "पहले शिष्य को सिखाओ। फिर तुम अकेले करके दिखा सकते हो।", // HINDI-REVIEW
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
  "common.locked": "यह कौशल अभी शुरू नहीं हुआ है। इसे खोलने के लिए अपने शिक्षक से कहो।", // HINDI-REVIEW
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
  "board.unknown.title": "किसी जानी हुई गलती से मेल नहीं खाता", // HINDI-REVIEW
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
  // HINDI-REVIEW (F8: the board's progress table and the mistake finder's drafts, all lines below)
  "board.progress.title": "प्रगति",
  "board.progress.skill": "कौशल",
  "board.progress.open": "पूरी कक्षा के लिए खोलें",
  "board.mined.title": "आपकी कक्षा में मिली नई गलतियाँ",
  "board.mined.none": "आपके निर्णय के लिए कुछ भी बाकी नहीं है।",
  "board.mined.draft": "आपकी कक्षा में मिली नई गलती: {label}",
  "board.mined.explains": "दर्ज किए गए {n} गलत उत्तर समझाती है · कोड ने {checked} प्रश्नों पर जाँचा",
  "board.mined.unreadable": "यह मसौदा पढ़ा नहीं जा सका। इसे अस्वीकार करें।",
  "board.mined.note":
    "गलती खोजने वाले (एक AI सहायक) ने इसका मसौदा बनाया और कोड ने इसे जाँचा। यह आपकी स्वीकृति के बाद ही इस्तेमाल होता है, और यह किसी भी बच्चे की महारत कभी नहीं बदलता।",
  // HINDI-REVIEW
  "board.export.impact": "असर के आँकड़ों में केवल असली कक्षाएँ गिनी जाती हैं। जाँच वाली और टूर वाली कक्षाएँ कभी नहीं गिनी जातीं।",

  // HINDI-REVIEW (F7, all lines below up to create.teacherCopy; teachers only)
  "board.consent.title": "बच्चों के लॉग इन करने से पहले",
  "board.consent.allowed": "विद्यालय ने इस कक्षा को शिष्य के उपयोग की अनुमति दी है, और अभिभावकों को बता दिया गया है।",
  "board.consent.slips": "अभिभावकों की मिली पर्चियाँ:",
  "board.consent.save": "सहेजें",
  "board.consent.needed": "जब तक यह सहेजा नहीं जाता, बच्चे लॉग इन नहीं कर सकते।",
  "board.consent.check": "बॉक्स पर निशान लगाएँ और अभिभावकों की पर्चियों की संख्या (0 या अधिक) लिखें, फिर सहेजें।",
  "board.consent.done": "{date} को दर्ज किया गया: विद्यालय ने इस कक्षा को अनुमति दी, और अभिभावकों को बताया गया ({n} पर्चियाँ मिलीं)।",
  "board.consent.doneOld": "यह कक्षा अनुमति दर्ज करने की सुविधा से पहले से चल रही थी, इसलिए इसे {date} को दर्ज माना गया है।",
  "board.cooldown.title": "परीक्षा में चूकने के बाद",
  "board.cooldown.intro": "परीक्षा में चूकने के बाद, अगली कोशिश खुलती है:",
  "board.cooldown.24": "कल (24 घंटे)",
  "board.cooldown.1": "अगले पीरियड में (1 घंटा)",
  "board.cooldown.0": "तुरंत (0)",
  "board.cooldown.save": "सहेजें",
  "board.cooldown.now": "अभी: परीक्षा में चूकने के {h} घंटे बाद अगली कोशिश खुलती है।",
  "board.goneAhead.head": "आगे बढ़ गए",
  "board.goneAhead.intro":
    "आगे बढ़ गए: वे बच्चे जिन्होंने यह कौशल अभी सीखा नहीं है, जबकि इस पर टिका आगे का कौशल उनके लिए खुल चुका है (जैसे, पूरी कक्षा के लिए खोला गया)।",
  "board.delete.link": "यह कक्षा और उसका सारा डेटा मिटाएँ",
  "delete.title": "कक्षा {code} मिटाएँ?",
  "delete.explain":
    "इससे कक्षा और उसके बारे में सब कुछ मिट जाएगा: हर बच्चे का कोड, उत्तर, हल, परीक्षाएँ और प्रगति, और कक्षा की लॉग पंक्तियाँ। इसे वापस नहीं लाया जा सकता।",
  "delete.keep": "अगर आपको आँकड़े चाहिए, तो पहले पायलट CSV डाउनलोड कर लें।",
  "delete.type": "पक्का करने के लिए कक्षा कोड ({code}) लिखें:",
  "delete.yes": "यह कक्षा और उसका सारा डेटा मिटाएँ",
  "delete.cancel": "रद्द करें",
  "delete.wrong": "यह इस कक्षा का कोड नहीं है। कुछ भी नहीं मिटाया गया।",
  "delete.done.title": "मिटा दिया गया",
  "delete.done.body": "मिटा दिया गया। इस कक्षा के बारे में कुछ भी नहीं रखा गया है।",
  "delete.done.back": "शिक्षक पृष्ठ पर वापस जाएँ",
  "recover.link": "PIN भूल गए?",
  "recover.title": "PIN भूल गए?",
  "recover.intro": "कक्षा कोड और वह रिकवरी कोड लिखें जो कक्षा बनाते समय PIN के साथ मिला था।",
  "recover.classCode": "कक्षा कोड",
  "recover.code": "रिकवरी कोड",
  "recover.go": "नया PIN पाएँ",
  "recover.wrong": "कक्षा कोड या रिकवरी कोड गलत है।",
  "recover.tooMany": "बहुत बार गलत रिकवरी कोड लिखा गया। 15 मिनट बाद फिर कोशिश करें।",
  "recover.none": "इस कक्षा का कोई रिकवरी कोड नहीं है।",
  "recover.done": "कक्षा {code} के लिए नया PIN",
  "recover.newPin": "नया शिक्षक PIN:",
  "recover.newCode": "नया रिकवरी कोड:",
  "recover.note": "दोनों अभी लिख लें। ये केवल एक बार दिखाए जाते हैं। पुराना PIN और पुराना रिकवरी कोड अब काम नहीं करते।",
  "recover.open": "कक्षा बोर्ड खोलें",
  "create.recovery": "रिकवरी कोड:",
  "create.recoveryNote": "अगर आप PIN भूल जाएँ, तो इस कोड से नया PIN मिलता है। इसे बच्चों के कोड से अलग, सुरक्षित रखें।",
  "create.teacherCopy": "शिक्षक की प्रति: यह भाग अपने पास रखें, बच्चों को न दें",

  // HINDI-REVIEW (P1a Paper Mode, all lines below up to paper.grid.auth; teachers, and the printed sheet)
  "paper.link": "कागज़ की वर्कशीट के उत्तर भरें",
  "paper.title": "कागज़ की वर्कशीट",
  "paper.intro":
    "आज कंप्यूटर नहीं हैं? एक वर्कशीट छापें और बच्चों से कागज़ पर हल करवाएँ। फिर हर बच्चे का अंतिम उत्तर यहाँ भरें। उत्तर उसी कोड से जाँचे जाते हैं जिससे शिष्य में लिखे उत्तर, और कक्षा बोर्ड पर दिखते हैं। कागज़ के उत्तर किसी बच्चे की प्रगति कभी नहीं बदलते।",
  "paper.new": "नई वर्कशीट बनाएँ",
  "paper.skill": "कौशल",
  "paper.count": "प्रश्नों की संख्या (1 से 20)",
  "paper.make": "वर्कशीट बनाएँ",
  "paper.bad": "एक कौशल चुनें और 1 से 20 तक प्रश्नों की संख्या लिखें।",
  "paper.list": "इस कक्षा की वर्कशीट",
  "paper.none": "अभी कोई वर्कशीट नहीं है।",
  "paper.item": "{code} · {skill} · {n} प्रश्न · {date}",
  "paper.back": "कक्षा बोर्ड पर वापस",
  "paper.toList": "सभी कागज़ की वर्कशीट",
  "paper.sheet.title": "वर्कशीट {code}",
  "paper.sheet.print": "वर्कशीट छापें",
  "paper.sheet.same": "हर बच्चे को एक जैसे प्रश्न मिलते हैं। आप यह वर्कशीट कभी भी फिर से छाप सकते हैं।",
  "paper.sheet.old": "यह वर्कशीट इस कौशल के पुराने संस्करण के लिए बनी थी। उत्तर भरने के लिए नई वर्कशीट बनाएँ।",
  "paper.print.code": "वर्कशीट {code}",
  "paper.print.class": "कक्षा {cls}",
  "paper.print.child": "तुम्हारा बच्चा-कोड (अपना नाम नहीं):",
  "paper.print.answer": "डिब्बे में केवल अपना अंतिम उत्तर लिखो।",
  "paper.grid.title": "उत्तर भरें",
  "paper.grid.intro":
    "हर बच्चा-कोड की एक पंक्ति। हर बच्चे का अंतिम उत्तर वैसे ही लिखें जैसे उसने लिखा, जैसे −3, 5/2 या x = 4। अगर बच्चे ने उत्तर नहीं दिया, तो डिब्बा खाली छोड़ दें।",
  "paper.grid.child": "बच्चा-कोड",
  "paper.grid.q": "प्र{n}",
  "paper.grid.save": "उत्तर सहेजें",
  "paper.grid.saved": "{n} उत्तर सहेजे गए ({right} सही)।",
  "paper.grid.already": "{n} डिब्बे पहले से सहेजे हुए थे, इसलिए वे नहीं बदले गए।",
  "paper.grid.unreadable": "ये उत्तर पढ़े नहीं जा सके, इसलिए सहेजे नहीं गए। इन्हें जाँचें और फिर से सहेजें:",
  "paper.grid.unreadableItem": "{code}, प्र{n}: {text}",
  "paper.grid.right": "सही",
  "paper.grid.wrong": "गलत",
  "paper.grid.note": "सहेजा हुआ डिब्बा बदला नहीं जा सकता।",
  "paper.grid.busy": "अभी-अभी किसी और ने इस वर्कशीट के उत्तर सहेजे। कुछ नहीं सहेजा गया: वर्कशीट फिर से खोलें।",
  "paper.grid.auth": "पहले कक्षा का PIN डालें।",

  // HINDI-REVIEW (P1b, all lines below up to board.recheck.needsLook)
  "recheck.link": "छोटी जाँच: 2 प्रश्न",
  "recheck.title": "छोटी जाँच",
  "recheck.intro": "एक हफ़्ता पहले तुमने इस कौशल में महारत हासिल की थी। यह दिखाने के लिए कि यह याद है, 2 नए प्रश्नों के उत्तर दो। कोई संकेत नहीं। तुम्हारे पास 15 मिनट हैं।",
  "recheck.start": "छोटी जाँच शुरू करो",
  "recheck.question": "प्रश्न {n} / {total}",
  "recheck.timeLeft": "बचा समय: {min} मिनट",
  "recheck.submit": "मेरा उत्तर सहेजो",
  "recheck.passed": "7 दिन बाद फिर से जाँचा गया ✓",
  "recheck.again": "इसे एक बार और देखना है। इस कौशल का फिर से अभ्यास करो। अगली छोटी जाँच एक हफ़्ते बाद खुलेगी।",
  "recheck.again.map": "एक बार और देखना है: इस कौशल का फिर से अभ्यास करो। अगली छोटी जाँच बाद में खुलेगी।",
  "recheck.stays": "इस कौशल पर तुम्हारी महारत बनी रहेगी।",
  "recheck.notDue": "अभी इस कौशल की कोई छोटी जाँच नहीं है।",
  "board.recheck.head": "फिर से जाँचा गया",
  "board.recheck.count": "महारत वाले {y} में से {x}",
  "board.recheck.intro":
    "फिर से जाँचा गया: जिन बच्चों ने कोई कौशल सीख लिया, उनमें से कितनों ने 7 या अधिक दिन बाद 2 नए प्रश्नों की छोटी जाँच सही की। छूटी हुई जाँच से \"महारत हासिल\" कभी नहीं हटता।",
  "board.recheck.needsLook": "एक बार और देखना है ({skill}): {codes}",

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
