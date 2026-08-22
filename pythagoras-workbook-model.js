export const PYTHAGORAS_TOPIC_NAME = 'משפט פיתגורס';
export const PYTHAGORAS_CURRICULUM_ID = 'g7.geo.pythagoras';

function findCurriculumNode(nodes, id) {
  for (const node of nodes ?? []) {
    if (node.id === id) return node;
    const found = findCurriculumNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * בונה את חוברת פיתגורס ממקור המטא־דאטה היחיד של הריפו: meta/topics.json.
 *
 * הסדר מכוון:
 * 1. כל דפי הנושא השטוח "משפט פיתגורס" בדיוק בסדרם — שם נמצאים דפי היסוד
 *    החדשים ראשונים ולאחריהם הרצף הוותיק ודפי התכנית.
 * 2. דפים נוספים שמוצגים בצומת תכנית הלימודים g7.geo.pythagoras אך הבית הראשי
 *    שלהם הוא נושא אחר (כיום 375–380) מצורפים בסוף, בלי לשכפל דף שכבר הופיע.
 *
 * חברות בחוברת אינה בלעדית: אותו דף רשאי להמשיך להופיע גם בחוברת/נושא אחר.
 */
export function buildPythagorasWorkbook(meta) {
  if (!meta || !Array.isArray(meta.topics)) {
    throw new Error('meta/topics.json אינו מכיל מערך topics תקין');
  }

  const primaryTopic = meta.topics.find((topic) => topic.name === PYTHAGORAS_TOPIC_NAME);
  if (!primaryTopic) throw new Error(`הנושא ${PYTHAGORAS_TOPIC_NAME} חסר ב-meta/topics.json`);

  const curriculumNode = findCurriculumNode(meta.curriculum?.nodes, PYTHAGORAS_CURRICULUM_ID);
  if (!curriculumNode) throw new Error(`הצומת ${PYTHAGORAS_CURRICULUM_ID} חסר ב-meta/topics.json`);

  const pageByNumber = new Map();
  for (const topic of meta.topics) {
    for (const page of topic.pages ?? []) {
      if (pageByNumber.has(page.number)) {
        throw new Error(`עמוד ${page.number} מופיע ביותר מנושא שטוח אחד`);
      }
      pageByNumber.set(page.number, { ...page, primaryTopic: topic.name });
    }
  }

  const primaryNumbers = (primaryTopic.pages ?? []).map((page) => page.number);
  const seen = new Set(primaryNumbers);
  const additionalNumbers = (curriculumNode.pages ?? []).filter((number) => !seen.has(number));
  const numbers = [...primaryNumbers, ...additionalNumbers];

  if (new Set(numbers).size !== numbers.length) {
    throw new Error('רצף חוברת פיתגורס מכיל דף כפול');
  }

  const pages = numbers.map((number, index) => {
    const page = pageByNumber.get(number);
    if (!page) throw new Error(`עמוד ${number} משויך לפיתגורס אך חסר במערך topics`);
    return {
      ...page,
      sourceNumber: number,
      workbookNumber: index + 1,
    };
  });

  return {
    id: 'pythagoras',
    name: PYTHAGORAS_TOPIC_NAME,
    source: 'meta/topics.json',
    primaryCount: primaryNumbers.length,
    additionalCount: additionalNumbers.length,
    pages,
  };
}
