/**
 * ContentTypeClassifier - 内容类型分类器
 * 
 * 识别网页内容类型：
 * - 文档 (PDF, Word, 文档类网站)
 * - 视频 (视频网站, 直播平台)
 * - 图片 (图片网站, 社交媒体图片)
 * - 办公工具 (OA, 协作工具, 邮箱)
 * - 开发工具 (代码仓库, API文档, 开发平台)
 * - 社交网络 (社交媒体, 聊天工具)
 * - 购物电商
 * - 新闻资讯
 * - 搜索引擎
 */

class ContentTypeClassifier {
  constructor(options = {}) {
    this.customPatterns = new Map();
    this.customWeights = options.customWeights || {};
    
    this.defaultWeights = {
      domain: 0.5,
      path: 0.25,
      title: 0.2,
      query: 0.05
    };

    this.contentTypePatterns = {
      document: {
        name: '文档',
        icon: '📄',
        color: '#4CAF50',
        domains: [
          'docs.google.com',
          'drive.google.com',
          'onedrive.live.com',
          'sharepoint.com',
          'dropbox.com',
          'box.com',
          'notion.so',
          'evernote.com',
          'confluence.atlassian.com',
          'slite.com',
          'quip.com',
          'miro.com',
          'figma.com',
          'canva.com',
          'adobe.com',
          'office.com',
          'office365.com',
          'docsend.com',
          'scribd.com',
          'slideshare.net',
          'prezi.com',
          'pdfdrive.com',
          'academia.edu',
          'researchgate.net',
          'ieee.org',
          'acm.org',
          'arxiv.org',
          'zhihu.com',
          'zhuanlan.zhihu.com',
          'jianshu.com',
          'csdn.net',
          'cnblogs.com',
          'segmentfault.com',
          'juejin.cn',
          'oschina.net',
          'bookstack.cn',
          'yuque.com',
          'wolai.com',
          'feishu.cn',
          'dingtalk.com',
          'wework.cn'
        ],
        pathPatterns: [
          '/doc',
          '/document',
          '/docs',
          '/pdf',
          '/article',
          '/blog',
          '/post',
          '/wiki',
          '/help',
          '/support',
          '/knowledge',
          '/guide',
          '/tutorial',
          '/learn',
          '/course',
          '/ebook',
          '/book',
          '/notes',
          '/notebook',
          '/whitepaper',
          '/report',
          '/case-study',
          '/research'
        ],
        titleKeywords: [
          'pdf', '文档', '报告', '论文', '文章', '博客', '教程',
          '指南', '帮助', 'wiki', '百科', '笔记', 'notebook',
          '电子书', 'ebook', '白皮书', 'whitepaper', '研究',
          '案例', 'case study', '文档中心', '知识库'
        ],
        fileExtensions: [
          '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
          '.txt', '.rtf', '.odt', '.ods', '.odp', '.epub', '.mobi'
        ]
      },
      
      video: {
        name: '视频',
        icon: '🎬',
        color: '#FF5722',
        domains: [
          'youtube.com',
          'youtu.be',
          'vimeo.com',
          'dailymotion.com',
          'twitch.tv',
          'netflix.com',
          'hulu.com',
          'disneyplus.com',
          'hbo.com',
          'amazon.com',
          'primevideo.com',
          'bilibili.com',
          'bilibili.cn',
          'iqiyi.com',
          'youku.com',
          'tudou.com',
          'mgtv.com',
          'le.com',
          'pptv.com',
          'sohu.com',
          'ifeng.com',
          'tencent.com',
          'v.qq.com',
          'live.qq.com',
          'douyin.com',
          'tiktok.com',
          'kuaishou.com',
          'xiaohongshu.com',
          'weibo.com',
          'weibo.cn',
          'huya.com',
          'douyu.com',
          'yy.com',
          'inke.cn',
          'huajiao.com',
          'bigo.tv',
          'pearvideo.com',
          'thepaper.cn',
          'ixigua.com',
          'toutiao.com',
          '36kr.com',
          'zhihu.com',
          'ted.com',
          'udemy.com',
          'coursera.org',
          'edX.org',
          'lynda.com',
          'pluralsight.com',
          'skillshare.com',
          'masterclass.com'
        ],
        pathPatterns: [
          '/watch',
          '/video',
          '/videos',
          '/v/',
          '/live',
          '/stream',
          '/broadcast',
          '/tv',
          '/movie',
          '/movies',
          '/film',
          '/show',
          '/episode',
          '/clip',
          '/reel',
          '/shorts',
          '/tiktok',
          '/playlist',
          '/channel'
        ],
        titleKeywords: [
          '视频', '直播', '电影', '电视剧', '综艺', '动漫',
          'watch', 'video', 'live', 'stream', 'movie', 'film',
          'episode', 'season', '预告片', '预告', 'trailer',
          '教程', 'tutorial', '课程', 'course', 'lecture'
        ],
        queryPatterns: [
          'v=',
          'video_id=',
          'vid='
        ]
      },
      
      image: {
        name: '图片',
        icon: '🖼️',
        color: '#E91E63',
        domains: [
          'unsplash.com',
          'pexels.com',
          'pixabay.com',
          'shutterstock.com',
          'istockphoto.com',
          'gettyimages.com',
          'adobe.com',
          'stock.adobe.com',
          'flickr.com',
          '500px.com',
          'instagram.com',
          'pinterest.com',
          'tumblr.com',
          'deviantart.com',
          'artstation.com',
          'dribbble.com',
          'behance.net',
          'imgur.com',
          'giphy.com',
          'tenor.com',
          'reddit.com',
          'imgflip.com',
          'canva.com',
          'figma.com',
          'photopea.com',
          'pixlr.com',
          'fotor.com',
          'baike.baidu.com',
          'image.baidu.com',
          'pic.sogou.com',
          'images.so.com',
          'bing.com',
          'google.com',
          'huaban.com',
          '699pic.com',
          'ibaotu.com',
          '58pic.com',
          '90design.com',
          'fotor.com.cn',
          'gracg.com',
          'zcool.com.cn',
          'ui.cn',
          'uisdc.com',
          'xueui.cn'
        ],
        pathPatterns: [
          '/image',
          '/images',
          '/img',
          '/photo',
          '/photos',
          '/gallery',
          '/album',
          '/wallpaper',
          '/background',
          '/icon',
          '/icons',
          '/svg',
          '/png',
          '/jpg',
          '/jpeg',
          '/gif',
          '/artwork',
          '/design',
          '/illustration',
          '/drawing',
          '/sketch'
        ],
        titleKeywords: [
          '图片', '照片', '图像', '壁纸', '图标', '设计',
          '插画', '艺术', '摄影', 'gallery', 'photo', 'image',
          'wallpaper', 'icon', 'design', 'art', 'illustration',
          '手绘', '漫画', 'anime', 'manga', '二次元'
        ],
        fileExtensions: [
          '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
          '.svg', '.ico', '.tif', '.tiff', '.raw', '.psd',
          '.ai', '.eps', '.pdf', '.xcf'
        ]
      },
      
      office: {
        name: '办公工具',
        icon: '💼',
        color: '#2196F3',
        domains: [
          'office.com',
          'office365.com',
          'microsoft365.com',
          'outlook.com',
          'outlook.office.com',
          'gmail.com',
          'mail.google.com',
          'yahoo.com',
          'hotmail.com',
          'live.com',
          'protonmail.com',
          'tutanota.com',
          'fastmail.com',
          'zoom.us',
          'teams.microsoft.com',
          'slack.com',
          'discord.com',
          'meet.google.com',
          'webex.com',
          'gotomeeting.com',
          'jira.atlassian.com',
          'trello.com',
          'asana.com',
          'notion.so',
          'basecamp.com',
          'clickup.com',
          'monday.com',
          'wrike.com',
          'todoist.com',
          'ticktick.com',
          'any.do',
          'rememberthemilk.com',
          'calendly.com',
          'doodle.com',
          'xmail.com',
          '139.com',
          '189.cn',
          'wo.cn',
          '163.com',
          'mail.163.com',
          '126.com',
          'yeah.net',
          'qq.com',
          'mail.qq.com',
          'foxmail.com',
          'sina.com.cn',
          'mail.sina.com.cn',
          'sohu.com',
          'vip.sohu.com',
          '21cn.com',
          '189.cn',
          'feishu.cn',
          'feishu.com',
          'larksuite.com',
          'dingtalk.com',
          'taobao.com',
          'tmall.com',
          'alipay.com',
          '钉钉',
          'wework.cn',
          '企业微信',
          'qy.weixin.qq.com',
          'work.weixin.qq.com',
          'wps.cn',
          'wps.com',
          'kdocs.cn',
          'yunshangxiezuo.com',
          'teambition.com',
          'coding.net',
          'gitee.com',
          'gitlab.com',
          'github.com',
          'bitbucket.org',
          'azure.com',
          'aws.amazon.com',
          'cloud.tencent.com',
          'aliyun.com',
          'huaweicloud.com',
          'baidu.com',
          'cloud.google.com'
        ],
        pathPatterns: [
          '/mail',
          '/email',
          '/inbox',
          '/message',
          '/messages',
          '/chat',
          '/meeting',
          '/meet',
          '/calendar',
          '/cal',
          '/task',
          '/tasks',
          '/todo',
          '/project',
          '/projects',
          '/board',
          '/workspace',
          '/team',
          '/collab',
          '/collaboration',
          '/office',
          '/work'
        ],
        titleKeywords: [
          '邮箱', '邮件', 'email', 'mail', 'inbox',
          '会议', 'meeting', 'zoom', 'teams', 'slack', 'discord',
          '日程', 'calendar', '任务', 'task', 'todo',
          '项目', 'project', '协作', 'collaboration',
          '办公', 'office', '工作', 'work', '团队', 'team'
        ]
      },
      
      development: {
        name: '开发工具',
        icon: '💻',
        color: '#673AB7',
        domains: [
          'github.com',
          'gitlab.com',
          'bitbucket.org',
          'gitee.com',
          'coding.net',
          'gitcode.com',
          'atom.io',
          'code.visualstudio.com',
          'vscode.dev',
          'codesandbox.io',
          'codepen.io',
          'jsfiddle.net',
          'stackblitz.com',
          'repl.it',
          'glitch.com',
          'dev.tencent.com',
          'cloud.tencent.com',
          'developer.aliyun.com',
          'huaweicloud.com',
          'console.aws.amazon.com',
          'portal.azure.com',
          'console.cloud.google.com',
          'vercel.com',
          'netlify.com',
          'heroku.com',
          'digitalocean.com',
          'linode.com',
          'docker.com',
          'hub.docker.com',
          'kubernetes.io',
          'stackoverflow.com',
          'stackexchange.com',
          'serverfault.com',
          'superuser.com',
          'github.io',
          'npmjs.com',
          'npmjs.org',
          'yarnpkg.com',
          'pip.pypa.io',
          'pypi.org',
          'rubygems.org',
          'crates.io',
          'pub.dev',
          'maven.apache.org',
          'mvnrepository.com',
          'nuget.org',
          'packagist.org',
          'go.dev',
          'pkg.go.dev',
          'deno.land',
          'nodejs.org',
          'python.org',
          'java.com',
          'oracle.com',
          'jetbrains.com',
          'code.visualstudio.com',
          'atom.io',
          'sublimetext.com',
          'vim.org',
          'neovim.io',
          'emacs.org',
          'developer.mozilla.org',
          'mdn.io',
          'w3schools.com',
          'caniuse.com',
          'caniuse.dev',
          'jsfiddle.net',
          'babeljs.io',
          'webpack.js.org',
          'vitejs.dev',
          'rollupjs.org',
          'parceljs.org',
          'jestjs.io',
          'testing-library.com',
          'cypress.io',
          'playwright.dev',
          'postman.com',
          'insomnia.rest',
          'swagger.io',
          'openapi.org',
          'graphql.org',
          'apollographql.com',
          'mongodb.com',
          'mongodb.org',
          'mysql.com',
          'postgresql.org',
          'redis.io',
          'elasticsearch.org',
          'kibana.co',
          'logstash.net',
          'prometheus.io',
          'grafana.com',
          'datadoghq.com',
          'newrelic.com',
          'sentry.io',
          'bugsnag.com',
          'segment.com',
          'segment.io',
          'amplitude.com',
          'mixpanel.com',
          'hotjar.com',
          'optimizely.com',
          'launchdarkly.com',
          'juejin.cn',
          'segmentfault.com',
          'oschina.net',
          'cnblogs.com',
          'csdn.net',
          'v2ex.com',
          'zhihu.com',
          'ruby-china.org',
          'golangtc.com',
          'nodejs.cn',
          'webpack.docschina.org',
          'react.docschina.org',
          'vuejs.org',
          'cn.vuejs.org',
          'angular.io',
          'angular.cn',
          'svelte.dev',
          'reactjs.org',
          'react.dev',
          'nextjs.org',
          'nuxt.com',
          'gatsbyjs.com',
          'remix.run'
        ],
        pathPatterns: [
          '/code',
          '/src',
          '/source',
          '/repo',
          '/repository',
          '/project',
          '/api',
          '/docs',
          '/documentation',
          '/dev',
          '/developer',
          '/developers',
          '/console',
          '/dashboard',
          '/admin',
          '/config',
          '/settings',
          '/pipeline',
          '/ci',
          '/cd',
          '/build',
          '/deploy',
          '/test',
          '/debug',
          '/log',
          '/logs',
          '/monitor',
          '/metrics',
          '/trace',
          '/issue',
          '/issues',
          '/pull',
          '/pr',
          '/merge',
          '/commit',
          '/branch',
          '/tag',
          '/release'
        ],
        titleKeywords: [
          '代码', '源码', 'code', 'source', 'repo', 'repository',
          '开发', 'developer', 'development', 'dev',
          'api', '文档', 'docs', 'documentation',
          '测试', 'test', '调试', 'debug',
          '部署', 'deploy', '构建', 'build',
          'git', 'github', 'gitlab', 'gitee',
          '框架', 'framework', '库', 'library',
          'package', 'npm', 'pip', 'maven', 'gradle',
          'docker', 'kubernetes', 'k8s', '容器',
          '服务器', 'server', '云服务', 'cloud',
          '数据库', 'database', 'mysql', 'postgres', 'redis',
          '监控', 'monitor', '日志', 'log',
          '错误', 'error', 'bug', 'issue'
        ]
      },
      
      social: {
        name: '社交网络',
        icon: '👥',
        color: '#00BCD4',
        domains: [
          'facebook.com',
          'fb.com',
          'twitter.com',
          'x.com',
          'instagram.com',
          'linkedin.com',
          'pinterest.com',
          'tumblr.com',
          'reddit.com',
          'snapchat.com',
          'tiktok.com',
          'douyin.com',
          'weibo.com',
          'weibo.cn',
          'qq.com',
          'qzone.qq.com',
          'weixin.qq.com',
          'zhihu.com',
          'xiaohongshu.com',
          'bilibili.com',
          'tieba.baidu.com',
          'mafengwo.cn',
          'douban.com',
          'fanfou.com',
          'jianshu.com',
          'lofter.com',
          'yizhetuan.com',
          'kandian.com',
          'toutiao.com',
          'ixigua.com',
          'kuaishou.com',
          'huoshan.com',
          'meipai.com',
          'xiaoying.com',
          'yue365.com',
          'mogujie.com',
          'meilishuo.com',
          'alibaba.com',
          'taobao.com',
          'tmall.com',
          'jd.com',
          'pinduoduo.com',
          'suning.com',
          'gome.com.cn',
          'dangdang.com',
          'amazon.com',
          'ebay.com',
          'walmart.com',
          'target.com',
          'etsy.com',
          'shopify.com',
          'discord.com',
          'slack.com',
          'telegram.org',
          'telegram.com',
          'whatsapp.com',
          'wechat.com',
          'line.me',
          'kakaotalk.com',
          'signal.org',
          'wire.com',
          'matrix.org',
          'element.io'
        ],
        pathPatterns: [
          '/user',
          '/users',
          '/profile',
          '/u/',
          '/@',
          '/follow',
          '/following',
          '/follower',
          '/followers',
          '/friend',
          '/friends',
          '/post',
          '/posts',
          '/status',
          '/statuses',
          '/tweet',
          '/tweets',
          '/feed',
          '/timeline',
          '/message',
          '/messages',
          '/chat',
          '/chats',
          '/dm',
          '/inbox',
          '/notification',
          '/notifications',
          '/mention',
          '/mentions',
          '/comment',
          '/comments',
          '/like',
          '/likes',
          '/share',
          '/shares',
          '/repost',
          '/retweet'
        ],
        titleKeywords: [
          '用户', 'profile', 'user', '个人主页',
          '关注', 'follow', '粉丝', 'follower', '好友', 'friend',
          '动态', 'post', 'status', 'tweet', 'feed', 'timeline',
          '消息', 'message', '聊天', 'chat', '私信', 'dm',
          '通知', 'notification', '提醒', 'mention',
          '评论', 'comment', '点赞', 'like', '分享', 'share',
          '转发', 'repost', 'retweet', '收藏', '收藏夹',
          '社交', 'social', '社区', 'community', '论坛', 'forum'
        ]
      },
      
      shopping: {
        name: '购物电商',
        icon: '🛒',
        color: '#FF9800',
        domains: [
          'taobao.com',
          'tmall.com',
          'jd.com',
          'pinduoduo.com',
          'yangkeduo.com',
          'suning.com',
          'gome.com.cn',
          'dangdang.com',
          'amazon.com',
          'amazon.cn',
          'ebay.com',
          'walmart.com',
          'target.com',
          'bestbuy.com',
          'etsy.com',
          'shopify.com',
          'aliexpress.com',
          'alibaba.com',
          '1688.com',
          'dhgate.com',
          'lightinthebox.com',
          'shein.com',
          'romwe.com',
          'asos.com',
          'zara.com',
          'hm.com',
          'uniqlo.com',
          'gap.com',
          'nike.com',
          'adidas.com',
          'puma.com',
          'underarmour.com',
          'apple.com',
          'microsoft.com',
          'samsung.com',
          'huawei.com',
          'xiaomi.com',
          'mi.com',
          'oppo.com',
          'vivo.com',
          'oneplus.com',
          'realme.com',
          'dell.com',
          'hp.com',
          'lenovo.com',
          'asus.com',
          'acer.com',
          'msi.com',
          'gigabyte.com',
          'evga.com',
          'corsair.com',
          'logitech.com',
          'razer.com',
          'steelseries.com',
          'coolermaster.com',
          'thermaltake.com',
          'nzxt.com',
          'lian-li.com',
          'phoenix.com',
          'jd.hk',
          'kaola.com',
          'netease.com',
          'you.163.com',
          'xiaomiyoupin.com',
          'mi.com',
          'suning.com',
          'gome.com.cn',
          'dangdang.com',
          'amazon.cn',
          'amazon.com',
          'walmart.com',
          'target.com',
          'costco.com',
          'costco.com.cn',
          'samsclub.com',
          'samsclub.cn',
          'carrefour.com',
          'carrefour.com.cn',
          'rt-mart.com.cn',
          '永辉超市',
          'yonghui.com.cn',
          'meituan.com',
          'waimai.meituan.com',
          'dianping.com',
          'ele.me',
          'koubei.com',
          'fliggy.com',
          'ctrip.com',
          'qunar.com',
          'tuniu.com',
          'lvmama.com',
          'mafengwo.cn',
          'qunar.com',
          'ctrip.com',
          'booking.com',
          'airbnb.com',
          'airbnb.cn',
          'trip.com',
          'skyscanner.com',
          'expedia.com',
          'agoda.com',
          'hotels.com'
        ],
        pathPatterns: [
          '/product',
          '/products',
          '/item',
          '/items',
          '/goods',
          '/sku',
          '/detail',
          '/details',
          '/category',
          '/categories',
          '/catalog',
          '/shop',
          '/store',
          '/cart',
          '/checkout',
          '/order',
          '/orders',
          '/buy',
          '/purchase',
          '/pay',
          '/payment',
          '/coupon',
          '/coupons',
          '/discount',
          '/sale',
          '/promotion',
          '/deal',
          '/flash-sale',
          '/seckill',
          '/search',
          '/list',
          '/brand',
          '/brands',
          '/seller',
          '/store'
        ],
        titleKeywords: [
          '商品', 'product', 'item', 'goods', 'sku',
          '详情', 'detail', '分类', 'category', 'catalog',
          '购物车', 'cart', '结算', 'checkout',
          '订单', 'order', '购买', 'buy', 'purchase',
          '支付', 'pay', 'payment', '付款',
          '优惠', 'discount', 'coupon', '促销', 'promotion',
          '特价', 'sale', '秒杀', 'seckill', 'flash sale',
          '品牌', 'brand', '店铺', 'store', 'shop',
          '卖家', 'seller', '搜索', 'search',
          '电商', 'e-commerce', 'shopping', '购物'
        ]
      },
      
      news: {
        name: '新闻资讯',
        icon: '📰',
        color: '#795548',
        domains: [
          'bbc.com',
          'bbc.co.uk',
          'cnn.com',
          'foxnews.com',
          'nbcnews.com',
          'abcnews.go.com',
          'cbsnews.com',
          'msnbc.com',
          'bloomberg.com',
          'reuters.com',
          'ap.org',
          'apnews.com',
          'nytimes.com',
          'washingtonpost.com',
          'wsj.com',
          'ft.com',
          'economist.com',
          'time.com',
          'newsweek.com',
          'usatoday.com',
          'theguardian.com',
          'independent.co.uk',
          'telegraph.co.uk',
          'thetimes.co.uk',
          'scmp.com',
          'reuters.com',
          'bloomberg.com',
          'forbes.com',
          'fortune.com',
          'businessinsider.com',
          'cnbc.com',
          'marketwatch.com',
          'seekingalpha.com',
          'investopedia.com',
          'yahoo.com',
          'yahoo.co.jp',
          'google.com/news',
          'news.google.com',
          'apple.com/newsroom',
          'microsoft.com/en-us/newsroom',
          'techcrunch.com',
          'theverge.com',
          'engadget.com',
          'gizmodo.com',
          'wired.com',
          'arstechnica.com',
          'slashdot.org',
          ' zdnet.com',
          'cnet.com',
          'pcmag.com',
          'tomshardware.com',
          'anandtech.com',
          'hexus.net',
          'bit-tech.net',
          'tencent.com',
          'qq.com',
          'news.qq.com',
          'finance.qq.com',
          'sports.qq.com',
          'ent.qq.com',
          'tech.qq.com',
          'auto.qq.com',
          'house.qq.com',
          'game.qq.com',
          'mil.qq.com',
          'news.qq.com',
          'sina.com.cn',
          'news.sina.com.cn',
          'finance.sina.com.cn',
          'sports.sina.com.cn',
          'ent.sina.com.cn',
          'tech.sina.com.cn',
          'auto.sina.com.cn',
          'house.sina.com.cn',
          'game.sina.com.cn',
          'mil.news.sina.com.cn',
          'sohu.com',
          'news.sohu.com',
          'finance.sohu.com',
          'sports.sohu.com',
          'yule.sohu.com',
          'it.sohu.com',
          'auto.sohu.com',
          'house.sohu.com',
          'game.sohu.com',
          'mil.sohu.com',
          '163.com',
          'news.163.com',
          'money.163.com',
          'sports.163.com',
          'ent.163.com',
          'tech.163.com',
          'auto.163.com',
          'house.163.com',
          'game.163.com',
          'war.163.com',
          'ifeng.com',
          'news.ifeng.com',
          'finance.ifeng.com',
          'sports.ifeng.com',
          'ent.ifeng.com',
          'tech.ifeng.com',
          'auto.ifeng.com',
          'house.ifeng.com',
          'game.ifeng.com',
          'mil.ifeng.com',
          'thepaper.cn',
          'pengpai.cn',
          'guancha.cn',
          'chinanews.com',
          'news.cn',
          'people.com.cn',
          'xinhuanet.com',
          'cctv.com',
          'tv.cctv.com',
          'news.cctv.com',
          'huanqiu.com',
          'huanqiu.com',
          'globaltimes.cn',
          'chinadaily.com.cn',
          'ecns.cn',
          'caixin.com',
          'yicai.com',
          '10jqka.com.cn',
          'eastmoney.com',
          'stockstar.com',
          'hexun.com',
          'jrj.com',
          'xueqiu.com',
          'gupiao.eastmoney.com',
          '36kr.com',
          'huxiu.com',
          'iyiou.com',
          'tmtpost.com',
          'leiphone.com',
          'pingwest.com',
          'geekpark.net',
          'ifanr.com',
          'zhidx.com',
          'techweb.com.cn',
          'cnbeta.com',
          'itbear.com.cn',
          'pconline.com.cn',
          'zol.com.cn',
          'pcpop.com',
          'ithome.com',
          'mydrivers.com',
          'fastcompany.cn',
          'woshipm.com',
          'chanjet.com',
          'fanli.com',
          'smzdm.com',
          '什么值得买',
          'duokan.com',
          'jingjiguancha.com',
          'caijing.com.cn',
          'yicai.com',
          'ce.cn',
          'people.com.cn',
          'xinhuanet.com',
          'china.com.cn',
          'huanqiu.com'
        ],
        pathPatterns: [
          '/news',
          '/article',
          '/articles',
          '/story',
          '/stories',
          '/report',
          '/reports',
          '/headline',
          '/headlines',
          '/breaking',
          '/live',
          '/update',
          '/updates',
          '/coverage',
          '/analysis',
          '/opinion',
          '/editorial',
          '/column',
          '/columns',
          '/blog',
          '/blogs',
          '/post',
          '/posts',
          '/topic',
          '/topics',
          '/subject',
          '/feature',
          '/features',
          '/magazine',
          '/issue',
          '/edition',
          '/finance',
          '/business',
          '/economy',
          '/market',
          '/stock',
          '/sports',
          '/entertainment',
          '/ent',
          '/tech',
          '/technology',
          '/auto',
          '/lifestyle',
          '/health',
          '/science',
          '/education',
          '/politics',
          '/world',
          '/international',
          '/china',
          '/local'
        ],
        titleKeywords: [
          '新闻', 'news', '报道', 'report', 'article', 'story',
          '头条', 'headline', '突发', 'breaking', '快讯',
          '直播', 'live', '更新', 'update', '最新',
          '分析', 'analysis', '评论', 'opinion', 'editorial',
          '专栏', 'column', '博客', 'blog', '专题', 'topic',
          '财经', 'finance', 'business', '经济', 'economy',
          '市场', 'market', '股票', 'stock', '基金', 'fund',
          '体育', 'sports', '娱乐', 'entertainment', 'ent',
          '科技', 'tech', 'technology', '汽车', 'auto',
          '生活', 'lifestyle', '健康', 'health',
          '科学', 'science', '教育', 'education',
          '政治', 'politics', '国际', 'international', 'world',
          '国内', 'china', 'local', '地方'
        ]
      },
      
      search: {
        name: '搜索引擎',
        icon: '🔍',
        color: '#607D8B',
        domains: [
          'google.com',
          'google.cn',
          'google.com.hk',
          'google.com.tw',
          'google.co.jp',
          'google.co.uk',
          'google.de',
          'google.fr',
          'google.es',
          'google.it',
          'google.com.br',
          'google.com.au',
          'google.ca',
          'google.com.mx',
          'google.co.in',
          'bing.com',
          'bing.com.cn',
          'baidu.com',
          'www.baidu.com',
          'm.baidu.com',
          'image.baidu.com',
          'video.baidu.com',
          'news.baidu.com',
          'zhidao.baidu.com',
          'tieba.baidu.com',
          'baike.baidu.com',
          'wenku.baidu.com',
          'music.baidu.com',
          'map.baidu.com',
          'sogou.com',
          'www.sogou.com',
          'pic.sogou.com',
          'video.sogou.com',
          'news.sogou.com',
          'zhihu.com',
          'zhihu.sogou.com',
          'weixin.sogou.com',
          'so.com',
          'www.so.com',
          'image.so.com',
          'video.so.com',
          'news.so.com',
          'm.so.com',
          'sm.cn',
          'www.sm.cn',
          'yandex.com',
          'yandex.ru',
          'duckduckgo.com',
          'ecosia.org',
          'qwant.com',
          'startpage.com',
          'searx.me',
          'searx.space',
          'mojeek.com',
          'swisscows.com',
          'metager.org',
          'gibiru.com',
          'ixquick.com',
          'yahoo.com',
          'search.yahoo.com',
          'yahoo.co.jp',
          'yahoo.co.uk',
          'aol.com',
          'search.aol.com',
          'ask.com',
          'search.ask.com',
          'lycos.com',
          'excite.com',
          'dogpile.com',
          'webcrawler.com',
          'infospace.com',
          'about.com',
          'search.about.com'
        ],
        pathPatterns: [
          '/search',
          '/webhp',
          '/?q=',
          '/search?q=',
          '/s?wd=',
          '/s?word=',
          '/s?query=',
          '/search?query=',
          '/search?keyword=',
          '/web',
          '/images',
          '/image',
          '/videos',
          '/video',
          '/news',
          '/maps',
          '/map',
          '/shopping',
          '/scholar',
          '/books',
          '/flights',
          '/finance',
          '/translate',
          '/translator',
          '/dictionary',
          '/calculator',
          '/weather',
          '/news',
          '/wiki',
          '/zhidao',
          '/baike',
          '/wenku',
          '/zhihu',
          '/tieba'
        ],
        titleKeywords: [
          '搜索', 'search', 'query', '查找', '查询',
          '结果', 'result', '网页', 'web', '网站',
          '图片', 'images', 'image', '视频', 'video', 'videos',
          '新闻', 'news', '地图', 'map', 'maps',
          '购物', 'shopping', '学术', 'scholar',
          '翻译', 'translate', '词典', 'dictionary',
          '百科', 'wiki', 'baike', 'zhidao',
          '文库', 'wenku', '知乎', 'zhihu', '贴吧', 'tieba',
          '问答', 'question', 'answer', '百度', 'baidu',
          '谷歌', 'google', '必应', 'bing', '搜狗', 'sogou',
          '360搜索', 'so.com', '神马', 'sm.cn'
        ],
        queryPatterns: [
          'q=',
          'query=',
          'wd=',
          'word=',
          'keyword=',
          'search=',
          'key='
        ]
      },
      
      entertainment: {
        name: '娱乐休闲',
        icon: '🎮',
        color: '#9C27B0',
        domains: [
          'steamcommunity.com',
          'store.steampowered.com',
          'epicgames.com',
          'store.epicgames.com',
          'gog.com',
          'origin.com',
          'ea.com',
          'ubisoft.com',
          'blizzard.com',
          'battle.net',
          'riotgames.com',
          'leagueoflegends.com',
          'playvalorant.com',
          'dota2.com',
          'csgo.com',
          'counter-strike.net',
          'teamfortress.com',
          'halo.xbox.com',
          'forzamotorsport.net',
          'gears5.com',
          'playstation.com',
          'store.playstation.com',
          'xbox.com',
          'microsoft.com/en-us/store/games',
          'nintendo.com',
          'nintendo.co.jp',
          'nintendo.com/switch',
          'roblox.com',
          'minecraft.net',
          'mojang.com',
          'fortnite.com',
          'apexlegends.com',
          'callofduty.com',
          'battlefield.com',
          'assassinscreed.com',
          'far-cry.ubisoft.com',
          'watchdogs.ubisoft.com',
          'tomclancy.com',
          'rainbow6.com',
          'thedivisiongame.com',
          'ghost-recon.ubisoft.com',
          'cyberpunk.net',
          'thewitcher.com',
          'cdprojektred.com',
          'rockstargames.com',
          'gtav.com',
          'reddeadredemption.com',
          'bns.plaync.com',
          'lineage.com',
          'aion.plaync.com',
          'guildwars2.com',
          'finalfantasyxiv.com',
          'worldofwarcraft.com',
          'warcraft.com',
          'hearthstone.com',
          'starcraft2.com',
          'overwatch.com',
          'diablo.com',
          'wowchina.com',
          'game.163.com',
          'play.163.com',
          'game.qq.com',
          'game.weixin.qq.com',
          'gamecenter.qq.com',
          'pvp.qq.com',
          'lol.qq.com',
          'game.qq.com',
          'dnf.qq.com',
          'cf.qq.com',
          'qqgame.qq.com',
          'qqgame.qq.com',
          'igame.qq.com',
          'game.163.com',
          'play.163.com',
          'mc.163.com',
          'stzb.163.com',
          'yys.163.com',
          'xyq.163.com',
          'qnmh.163.com',
          'hs.blizzard.cn',
          'ow.blizzard.cn',
          'sc2.blizzard.cn',
          'diablo3.blizzard.cn',
          'wow.blizzard.cn',
          'game.sina.com.cn',
          'games.sina.com.cn',
          'game.sohu.com',
          'game.china.com',
          '17173.com',
          'game.17173.com',
          '3dmgame.com',
          'gamersky.com',
          'ali213.net',
          'yxdown.com',
          'yxbao.com',
          'pcgames.com.cn',
          'games.qq.com',
          'games.sina.com.cn',
          'games.sohu.com',
          'game.17173.com',
          '4399.com',
          '7k7k.com',
          '2144.com',
          '3366.com',
          'game.com',
          'xiaoyouxi.com',
          'flashgame.com',
          'miniclip.com',
          'kongregate.com',
          'newgrounds.com',
          'armorgames.com',
          'poki.com',
          'crazygames.com',
          'agame.com',
          'y8.com',
          'friv.com',
          'twitch.tv',
          'm.twitch.tv',
          'youtube.com/gaming',
          'gaming.youtube.com',
          'mixer.com',
          'dlive.tv',
          'trovo.live',
          'douyu.com',
          'm.douyu.com',
          'huya.com',
          'm.huya.com',
          'longzhu.com',
          'quanmin.tv',
          'panda.tv',
          'zhanqi.tv',
          'huomao.com',
          'inke.cn',
          'yy.com',
          '6.cn',
          '9158.com',
          'fanxing.com',
          'kuwo.cn',
          'kugou.com',
          'qqmusic.com',
          'music.163.com',
          'xiami.com',
          'spotify.com',
          'applemusic.com',
          'music.apple.com',
          'deezer.com',
          'tidal.com',
          'soundcloud.com',
          'bandcamp.com',
          'mixcloud.com',
          'last.fm',
          'genius.com',
          'musixmatch.com',
          'shazam.com',
          'midomi.com',
          'zhihu.com',
          'bilibili.com',
          'acfun.cn',
          'dilidili.com',
          'dmhy.org',
          'btbtt11.com',
          'skr.skr1.cc',
          'zimuku.org',
          'subhd.com',
          'assrt.net'
        ],
        pathPatterns: [
          '/game',
          '/games',
          '/play',
          '/store',
          '/dlc',
          '/expansion',
          '/update',
          '/patch',
          '/mod',
          '/mods',
          '/cheat',
          '/trainer',
          '/walkthrough',
          '/guide',
          '/tutorial',
          '/wiki',
          '/strategy',
          '/build',
          '/character',
          '/class',
          '/raid',
          '/dungeon',
          '/quest',
          '/mission',
          '/achievement',
          '/trophy',
          '/leaderboard',
          '/rank',
          '/ranking',
          '/competition',
          '/tournament',
          '/esport',
          '/esports',
          '/stream',
          '/live',
          '/video',
          '/clip',
          '/highlight',
          '/replay',
          '/vod',
          '/music',
          '/song',
          '/songs',
          '/album',
          '/albums',
          '/playlist',
          '/playlists',
          '/artist',
          '/artists',
          '/podcast',
          '/radio',
          '/station',
          '/anime',
          '/animation',
          '/cartoon',
          '/comic',
          '/comics',
          '/manga',
          '/manhua',
          '/manhwa',
          '/novel',
          '/lightnovel',
          '/webnovel',
          '/fanart',
          '/cosplay',
          '/doujin',
          '/acg',
          '/otaku'
        ],
        titleKeywords: [
          '游戏', 'game', 'games', 'play', '游玩',
          'steam', 'epic', 'xbox', 'playstation', 'switch',
          '网游', 'online', '手游', 'mobile', '单机', 'single',
          '攻略', 'guide', 'walkthrough', '教程', 'tutorial',
          '秘籍', 'cheat', '修改器', 'trainer', '存档', 'save',
          'mod', '模组', '补丁', 'patch', '更新', 'update',
          'dlc', '扩展', 'expansion', '赛季', 'season',
          '赛事', 'tournament', '电竞', 'esport', 'esports',
          '直播', 'stream', 'live', '视频', 'video',
          '集锦', 'highlight', '精彩', 'replay', '回放',
          '音乐', 'music', '歌曲', 'song', '专辑', 'album',
          '歌单', 'playlist', '歌手', 'artist', '电台', 'radio',
          '动漫', 'anime', '动画', 'animation', '漫画', 'comic',
          '二次元', '2d', 'acg', '宅', 'otaku',
          '小说', 'novel', '网文', 'webnovel', '轻小说', 'lightnovel'
        ]
      }
    };

    console.log('📑 ContentTypeClassifier initialized with', Object.keys(this.contentTypePatterns).length, 'categories');
  }

  // ========== 自定义模式管理 ==========

  addCustomPattern(contentType, patterns) {
    if (!this.contentTypePatterns[contentType]) {
      console.warn(`⚠️ Content type "${contentType}" not found, creating new category`);
      this.contentTypePatterns[contentType] = {
        name: contentType,
        icon: '📁',
        color: '#607D8B',
        domains: [],
        pathPatterns: [],
        titleKeywords: []
      };
    }

    const category = this.contentTypePatterns[contentType];
    
    if (patterns.domains) {
      category.domains = [...new Set([...category.domains, ...patterns.domains])];
    }
    if (patterns.pathPatterns) {
      category.pathPatterns = [...new Set([...category.pathPatterns, ...patterns.pathPatterns])];
    }
    if (patterns.titleKeywords) {
      category.titleKeywords = [...new Set([...category.titleKeywords, ...patterns.titleKeywords])];
    }
    if (patterns.fileExtensions) {
      if (!category.fileExtensions) category.fileExtensions = [];
      category.fileExtensions = [...new Set([...category.fileExtensions, ...patterns.fileExtensions])];
    }
    if (patterns.queryPatterns) {
      if (!category.queryPatterns) category.queryPatterns = [];
      category.queryPatterns = [...new Set([...category.queryPatterns, ...patterns.queryPatterns])];
    }

    console.log('➕ Added custom patterns for', contentType);
    return true;
  }

  removeCustomPattern(contentType, patterns) {
    if (!this.contentTypePatterns[contentType]) {
      console.warn(`⚠️ Content type "${contentType}" not found`);
      return false;
    }

    const category = this.contentTypePatterns[contentType];
    
    if (patterns.domains) {
      category.domains = category.domains.filter(d => !patterns.domains.includes(d));
    }
    if (patterns.pathPatterns) {
      category.pathPatterns = category.pathPatterns.filter(p => !patterns.pathPatterns.includes(p));
    }
    if (patterns.titleKeywords) {
      category.titleKeywords = category.titleKeywords.filter(k => !patterns.titleKeywords.includes(k));
    }

    return true;
  }

  setCustomWeights(weights) {
    this.customWeights = {
      ...this.defaultWeights,
      ...weights
    };
    console.log('⚖️ Custom weights set:', this.customWeights);
  }

  // ========== 分类核心方法 ==========

  classify(tab) {
    const url = tab.url || '';
    const title = tab.title || '';
    
    const scores = new Map();
    const matches = [];

    for (const [type, config] of Object.entries(this.contentTypePatterns)) {
      const score = this.calculateMatchScore(url, title, config);
      if (score > 0) {
        scores.set(type, score);
        matches.push({
          type,
          score,
          name: config.name,
          icon: config.icon,
          color: config.color
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return {
        type: 'other',
        name: '其他',
        icon: '🌐',
        color: '#607D8B',
        score: 0,
        matches: []
      };
    }

    return {
      ...matches[0],
      matches: matches.slice(0, 5)
    };
  }

  calculateMatchScore(url, title, config) {
    let totalScore = 0;
    const weights = this.customWeights || this.defaultWeights;

    const domainScore = this.matchDomain(url, config.domains || []);
    totalScore += domainScore * weights.domain;

    const pathScore = this.matchPath(url, config.pathPatterns || []);
    totalScore += pathScore * weights.path;

    const titleScore = this.matchTitle(title, config.titleKeywords || []);
    totalScore += titleScore * weights.title;

    const queryScore = this.matchQuery(url, config.queryPatterns || []);
    totalScore += queryScore * weights.query;

    const fileExtScore = this.matchFileExtension(url, config.fileExtensions || []);
    totalScore += fileExtScore * 0.15;

    return Math.min(totalScore, 1);
  }

  matchDomain(url, domains) {
    if (!url || domains.length === 0) return 0;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      for (const domain of domains) {
        const domainLower = domain.toLowerCase();
        
        if (hostname === domainLower || hostname.endsWith(`.${domainLower}`)) {
          return 1;
        }
      }
    } catch (e) {
      const urlLower = url.toLowerCase();
      for (const domain of domains) {
        const domainLower = domain.toLowerCase();
        if (urlLower.includes(domainLower)) {
          return 0.8;
        }
      }
    }

    return 0;
  }

  matchPath(url, patterns) {
    if (!url || patterns.length === 0) return 0;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      for (const pattern of patterns) {
        const patternLower = pattern.toLowerCase();
        
        if (pathname.includes(patternLower) || pathname.startsWith(patternLower)) {
          return 1;
        }
      }
    } catch (e) {
      const urlLower = url.toLowerCase();
      for (const pattern of patterns) {
        const patternLower = pattern.toLowerCase();
        if (urlLower.includes(patternLower)) {
          return 0.7;
        }
      }
    }

    return 0;
  }

  matchTitle(title, keywords) {
    if (!title || keywords.length === 0) return 0;

    const titleLower = title.toLowerCase();
    let matchCount = 0;

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (titleLower.includes(keywordLower)) {
        matchCount++;
      }
    }

    if (matchCount === 0) return 0;
    return Math.min(matchCount / Math.max(1, Math.floor(keywords.length * 0.3)), 1);
  }

  matchQuery(url, patterns) {
    if (!url || patterns.length === 0) return 0;

    try {
      const urlObj = new URL(url);
      const searchParams = urlObj.searchParams;
      
      for (const pattern of patterns) {
        const paramName = pattern.replace('=', '').toLowerCase();
        if (searchParams.has(paramName)) {
          return 1;
        }
      }
    } catch (e) {
      const urlLower = url.toLowerCase();
      for (const pattern of patterns) {
        if (urlLower.includes(pattern.toLowerCase())) {
          return 0.5;
        }
      }
    }

    return 0;
  }

  matchFileExtension(url, extensions) {
    if (!url || extensions.length === 0) return 0;

    const urlLower = url.toLowerCase();
    
    for (const ext of extensions) {
      const extLower = ext.toLowerCase();
      if (urlLower.endsWith(extLower) || urlLower.includes(`${extLower}?`) || urlLower.includes(`${extLower}#`)) {
        return 1;
      }
    }

    return 0;
  }

  // ========== 批量分类 ==========

  classifyAll(tabs) {
    const groups = new Map();
    const ungrouped = [];

    for (const tab of tabs) {
      const result = this.classify(tab);
      
      if (result.score > 0.3) {
        const key = result.type;
        if (!groups.has(key)) {
          groups.set(key, {
            id: `content_${key}`,
            name: result.name,
            type: 'content-type',
            contentType: key,
            icon: result.icon,
            color: result.color,
            tabs: [],
            collapsed: false,
            createdAt: Date.now()
          });
        }
        groups.get(key).tabs.push(tab);
      } else {
        ungrouped.push(tab);
      }
    }

    const resultGroups = Array.from(groups.values())
      .sort((a, b) => b.tabs.length - a.tabs.length);

    if (ungrouped.length > 0) {
      resultGroups.push({
        id: 'content_other',
        name: '其他',
        type: 'content-type',
        contentType: 'other',
        icon: '🌐',
        color: '#607D8B',
        tabs: ungrouped,
        collapsed: false,
        createdAt: Date.now()
      });
    }

    return resultGroups;
  }

  // ========== 获取分类信息 ==========

  getCategories() {
    const categories = [];
    for (const [type, config] of Object.entries(this.contentTypePatterns)) {
      categories.push({
        type,
        name: config.name,
        icon: config.icon,
        color: config.color,
        domainCount: (config.domains || []).length,
        patternCount: (config.pathPatterns || []).length + (config.titleKeywords || []).length
      });
    }
    return categories;
  }

  getCategoryInfo(type) {
    const config = this.contentTypePatterns[type];
    if (!config) return null;

    return {
      type,
      name: config.name,
      icon: config.icon,
      color: config.color,
      domains: config.domains || [],
      pathPatterns: config.pathPatterns || [],
      titleKeywords: config.titleKeywords || [],
      fileExtensions: config.fileExtensions || [],
      queryPatterns: config.queryPatterns || []
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentTypeClassifier;
}

if (typeof window !== 'undefined') {
  window.ContentTypeClassifier = ContentTypeClassifier;
}
