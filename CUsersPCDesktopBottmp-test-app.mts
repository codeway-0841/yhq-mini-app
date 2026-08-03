import 'dotenv/config'
process.env.NODE_ENV = 'test'
import supertest from 'supertest'
import express from 'express'
const { createApp } = await import('./server/app.ts')
const app = createApp()

let r = await supertest(app).post('/api/init').set('Content-Type','application/json').send('{"id": broken')
console.log('malformed JSON ->', r.status, JSON.stringify(r.body))

const big = JSON.stringify({ id: '1', first_name: 'a'.repeat(6e4) })
r = await supertest(app).post('/api/init').set('Content-Type','application/json').send(big)
console.log('oversized body ->', r.status, JSON.stringify(r.body).slice(0,150))

r = await supertest(app).post('/api/init').send({})
console.log('empty body ->', r.status, JSON.stringify(r.body).slice(0,300))

r = await supertest(app).post('/api/init').send({ id: 'abc', first_name: 'X' })
console.log('non-numeric id ->', r.status, JSON.stringify(r.body).slice(0,200))

// strict-mode req.query assignment (simulate validate with query schema)
const t2 = express()
t2.use((req,res,next)=>{ try { (req as any).query = {a:1}; res.json({ok:true}) } catch(e){ res.status(500).json({err: e.constructor.name+': '+e.message}) } })
const r2 = await supertest(t2).get('/x?b=2')
console.log('req.query assign (ESM strict) ->', r2.status, JSON.stringify(r2.body))

// strict-mode req.params assignment
const t3 = express()
t3.use((req,res,next)=>{ try { (req as any).params = {a:1}; res.json({ok:true}) } catch(e){ res.status(500).json({err: e.constructor.name+': '+e.message}) } })
const r3 = await supertest(t3).get('/x')
console.log('req.params assign (ESM strict) ->', r3.status, JSON.stringify(r3.body))
process.exit(0)
