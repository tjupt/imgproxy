addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const rules = {
  'https?:\\/\\/img\\d\\.doubanio\\.com\\/.+\\.jpg': {
    referer: 'https://movie.douban.com/',
  },
  'https?:\\/\\/hive.indienova.com\\/.+': {
    referer: 'https://indienova.com/',
  },
}

/**
 * @param {Request} request
 */
async function handleRequest(request) {
  const cache = caches.default
  const requestUrl = new URL(request.url).searchParams.get('url')

  if (requestUrl === null) {
    return new Response(null, { status: 403 })
  }

  // 1. 查询是否有规则能match，并获取额外的headers
  let matchedUrl = null
  let headers = null
  for (const re in rules) {
    const res = requestUrl.match(re)
    if (res !== null) {
      headers = rules[re]
      matchedUrl = res[0]
      break
    }
  }

  if (matchedUrl === null) {
    return new Response(null, { status: 403 })
  }

  let requestHeaders = Object.fromEntries(request.headers)
  headers = Object.assign({}, requestHeaders, headers)

  // 2. 查询Cloudflare缓存
  let response = await cache.match(matchedUrl)
  if (response) {
    // 2.1. 如果有缓存
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
    })
  }

  // 2.2. 如果无缓存，构造请求
  response = await fetch(new Request(matchedUrl), { headers: headers })

  if (response.status === 200) {
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
    })

    // 写缓存
    await cache.put(matchedUrl, response.clone())

    return response
  } else {
    return Response.redirect(matchedUrl, 302)
  }
}
