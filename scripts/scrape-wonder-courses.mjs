// scripts/scrape-wonder-courses.mjs
import fs from 'node:fs'
import path from 'node:path'

const courseUrls = [
  'https://wondering.app/learn/how-to-design-whatsapp-00778c2bcdcf373ebc442c10',
  'https://wondering.app/learn/the-art-of-meaningful-gathering-f0fec08d318c3f95d28761ba',
  'https://wondering.app/learn/architecture-patterns-and-trade-offs-1ade82a44fb38457ec24079b',
  'https://wondering.app/learn/everyday-design-fundamentals-5349d3c629bce3acfc6cd7af',
  'https://wondering.app/learn/cdn-for-engineers-beyond-static-caching-04dcefa25fa3847037d420c5',
  'https://wondering.app/learn/asking-good-questions-as-an-engineer-c2c97abd1b4cddc214bc3a33',
  'https://wondering.app/learn/ai-software-engineering-for-beginners-0565a631c4ca5bf2b2d4e71b',
  'https://wondering.app/learn/enterprise-llm-architecture-and-deployme-64a2f5b868ae8909929b1800',
  'https://wondering.app/learn/the-mom-test-for-product-0a451ddd348081f06a7ae6bd',
  'https://wondering.app/learn/solve-the-rubiks-cube-nukdx3',
  'https://wondering.app/learn/securing-software-development-lifecycles-16c85b4ca1f04d1788553285',
  'https://wondering.app/learn/penetration-testing-for-azure-devops-ee22d09768ead4a7114186dd',
  'https://wondering.app/learn/beginner-long-term-investing-framework-47b03acda6d07a940ba8ec30',
  'https://wondering.app/learn/cognitive-psychology-for-daily-productiv-77ccb9139ceb4f6e6fd7449b',
  'https://wondering.app/learn/the-creative-technologist-playbook-ddc1f8e84e9bbb4893dc9f64',
  'https://wondering.app/learn/llm-fundamentals-dd100aabe0be6e58837f4b31'
]

async function scrapeCourse(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`Failed to fetch ${url}: ${res.status}`)
      return null
    }
    const html = await res.text()

    // Title
    const titleMatch = html.match(/<title>(.*?) - Wondering<\/title>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Course'

    // Og Image
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i)
    const coverImage = ogImageMatch ? ogImageMatch[1].trim() : null

    // Description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
    const description = descMatch ? descMatch[1].trim() : ''

    // Course outline extraction
    // <section><h3>Section Title</h3><ol><li>Lesson 1</li><li>Lesson 2</li></ol></section>
    const sections = []
    const sectionRegex = /<section>\s*<h3>(.*?)<\/h3>\s*<ol>([\s\S]*?)<\/ol>\s*<\/section>/gi
    let secMatch
    let secIdx = 1

    while ((secMatch = sectionRegex.exec(html)) !== null) {
      const sectionTitle = secMatch[1].trim()
      const lessonsHtml = secMatch[2]
      const lessonRegex = /<li>(.*?)<\/li>/gi
      let lMatch
      const lessons = []
      let lesIdx = 1

      while ((lMatch = lessonRegex.exec(lessonsHtml)) !== null) {
        const lessonTitle = lMatch[1].trim()
        lessons.push({
          id: `les-${secIdx}-${lesIdx}`,
          title: lessonTitle,
          durationMinutes: 3,
          readTime: '~3 min read',
          difficulty: 'intermediate',
          keyTakeaways: [`Understand the core mechanisms of ${lessonTitle}`, `Identify practical architectural patterns and trade-offs`]
        })
        lesIdx++
      }

      sections.push({
        id: `sec-${secIdx}`,
        title: `${secIdx}. ${sectionTitle}`,
        lessons
      })
      secIdx++
    }

    const slug = url.split('/learn/')[1]?.split('-').slice(0, 4).join('-') || `course-${Date.now()}`

    return {
      id: slug,
      slug,
      title,
      description,
      coverImage,
      category: 'Software Engineering',
      author: 'Wondering',
      sections,
      estimatedMinutes: sections.reduce((acc, s) => acc + s.lessons.length * 3, 0),
      url
    }
  } catch (err) {
    console.error(`Error scraping ${url}:`, err.message)
    return null
  }
}

async function run() {
  console.log(`Starting scrape of ${courseUrls.length} Wondering courses...`)
  const results = []
  for (const url of courseUrls) {
    console.log(`Fetching ${url}...`)
    const data = await scrapeCourse(url)
    if (data) {
      results.push(data)
    }
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 200))
  }

  const outPath = path.resolve('src/features/wonder-studio/data/scraped-courses.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`Successfully scraped and saved ${results.length} courses to ${outPath}`)
}

run()
