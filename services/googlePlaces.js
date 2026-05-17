/**
 * googlePlaces.js
 * ───────────────
 * يجلب المطاعم والكافيهات من Google Places API
 * بالقرب من البصرة مع pagination عبر next_page_token
 */

import axios from 'axios'
import Place from '../models/Place.js'

const BASRA_LAT = 30.5085
const BASRA_LNG = 47.7804
const RADIUS_METERS = 8000          // 8 كيلومتر
const NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
const DELAY_MS = 2200              // Google يتطلب 2 ثانية بين الصفحات

// ─── تأخير بسيط ───
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── جلب صفحة واحدة ───
async function fetchPage(type, pageToken = null) {
  const params = {
    location: `${BASRA_LAT},${BASRA_LNG}`,
    radius:   RADIUS_METERS,
    type:     type,
    key:      process.env.GOOGLE_API_KEY,
    language: 'ar',
  }
  if (pageToken) params.pagetoken = pageToken

  const { data } = await axios.get(NEARBY_URL, { params })

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status} — ${data.error_message || ''}`)
  }

  return {
    results:       data.results || [],
    nextPageToken: data.next_page_token || null,
  }
}

// ─── جلب جميع الصفحات لنوع معين ───
async function fetchAllPages(type) {
  const all = []
  let pageToken = null
  let page = 1

  do {
    console.log(`📡 جلب ${type} — صفحة ${page}`)
    if (pageToken) await sleep(DELAY_MS) // يجب الانتظار بين الصفحات

    const { results, nextPageToken } = await fetchPage(type, pageToken)
    all.push(...results)
    console.log(`  → ${results.length} نتيجة (الإجمالي: ${all.length})`)

    pageToken = nextPageToken
    page++
  } while (pageToken && page <= 5) // حد أقصى 5 صفحات (~100 مكان)

  return all
}

// ─── تحويل بيانات Google إلى schema المشروع ───
function mapToSchema(raw, type) {
  return {
    place_id:   raw.place_id,
    name:       raw.name,
    type:       type,
    vicinity:   raw.vicinity || '',
    rating:     raw.rating || 0,
    user_ratings_total: raw.user_ratings_total || 0,
    price_level: raw.price_level ?? null,
    photo_reference: raw.photos?.[0]?.photo_reference || null,
    location: {
      lat: raw.geometry.location.lat,
      lng: raw.geometry.location.lng,
    },
    opening_hours: {
      open_now: raw.opening_hours?.open_now ?? null,
    },
    types:     raw.types || [],
    fetchedAt: new Date(),
  }
}

// ─── الدالة الرئيسية: جلب وتخزين الأماكن ───
export async function fetchAndStorePlaces() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY غير موجود في متغيرات البيئة')
  }

  const types = ['restaurant', 'cafe']
  let totalInserted = 0
  let totalUpdated  = 0
  let totalErrors   = 0

  for (const type of types) {
    console.log(`\n🔍 بدء جلب: ${type}`)
    let rawPlaces = []

    try {
      rawPlaces = await fetchAllPages(type)
    } catch (err) {
      console.error(`❌ خطأ في جلب ${type}:`, err.message)
      totalErrors++
      continue
    }

    // حفظ في MongoDB بشكل دفعي
    for (const raw of rawPlaces) {
      try {
        const doc = mapToSchema(raw, type)
        const result = await Place.findOneAndUpdate(
          { place_id: doc.place_id },
          { $set: doc },
          { upsert: true, new: true }
        )
        // upsert: تحديث إذا موجود، إضافة إذا جديد
        if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
          totalInserted++
        } else {
          totalUpdated++
        }
      } catch (err) {
        console.error(`  ⚠️ خطأ في حفظ ${raw.name}:`, err.message)
        totalErrors++
      }
    }
  }

  console.log(`\n✅ اكتمل الجلب:`)
  console.log(`  📥 مُضاف جديد: ${totalInserted}`)
  console.log(`  🔄 مُحدَّث: ${totalUpdated}`)
  console.log(`  ❌ أخطاء: ${totalErrors}`)

  return { inserted: totalInserted, updated: totalUpdated, errors: totalErrors }
}
