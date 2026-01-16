import { AutoRouter, cors, status } from 'itty-router'
import { download } from './routes/download'
import { upload } from './routes/upload'
import { dashboard, stats } from './routes/dashboard'

const { preflight, corsify } = cors({
	allowMethods: ['GET', 'PUT', 'OPTIONS'],
})
const router = AutoRouter({
	before: [preflight],
	finally: [corsify]
})

router
	.get('/download/:urlHASH', download)
	.put('/upload/:urlHASH', upload)
	.get('/analytics', dashboard)
	.get('/analytics/stats', stats)
	.all('*', () => status(404))


export default { ...router }
