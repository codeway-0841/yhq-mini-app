import { leaderboardRepository } from '../server/modules/leaderboard/leaderboard.repository'
leaderboardRepository.weeklyTop(5, null).then(r => { console.log('OK', r.entries.length, r.weekStart); process.exit(0) }).catch(e => { console.error('ERR:', e.message); process.exit(1) })
