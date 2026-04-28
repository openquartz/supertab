/**
 * SceneClassifier - 场景分类器
 * 
 * 识别访问场景：
 * - 工作场景 (办公、协作、邮件、会议)
 * - 学习场景 (教程、课程、文档、研究)
 * - 娱乐场景 (视频、游戏、社交、购物)
 * - 生活场景 (金融、健康、旅行、美食)
 * - 开发场景 (代码、API、技术文档)
 * 
 * 支持：
 * - 多维度自动归类
 * - 用户自定义归类权重
 * - 手动调整分类优先级
 */

class SceneClassifier {
  constructor(options = {}) {
    this.customScenePatterns = new Map();
    this.scenePriorities = new Map();
    this.userSceneWeights = new Map();
    
    this.defaultPriorities = {
      work: 5,
      development: 4,
      learning: 3,
      entertainment: 2,
      life: 1,
      other: 0
    };

    for (const [scene, priority] of Object.entries(this.defaultPriorities)) {
      this.scenePriorities.set(scene, priority);
    }

    this.scenePatterns = {
      work: {
        name: '工作',
        icon: '💼',
        color: '#1976D2',
        description: '办公协作、邮件会议、商务沟通',
        patterns: {
          domains: [
            'office.com', 'office365.com', 'microsoft365.com',
            'outlook.com', 'gmail.com', 'yahoo.com', 'hotmail.com',
            'zoom.us', 'teams.microsoft.com', 'meet.google.com',
            'webex.com', 'gotomeeting.com', 'slack.com', 'discord.com',
            'jira.atlassian.com', 'confluence.atlassian.com',
            'trello.com', 'asana.com', 'notion.so', 'basecamp.com',
            'clickup.com', 'monday.com', 'wrike.com', 'todoist.com',
            'feishu.cn', 'larksuite.com', 'dingtalk.com',
            'qy.weixin.qq.com', 'work.weixin.qq.com',
            'wps.cn', 'kdocs.cn', 'yunshangxiezuo.com',
            'teambition.com', 'coding.net', 'tower.im',
            'salesforce.com', 'hubspot.com', 'zendesk.com',
            'intercom.com', 'freshworks.com', 'zoho.com',
            'linkedin.com', 'xing.com', 'glassdoor.com',
            'indeed.com', 'monster.com', 'careerbuilder.com',
            'zhaopin.com', 'liepin.com', 'lagou.com', 'mokahr.com',
            '51job.com', 'zhipin.com', 'kanzhun.com',
            'dianping.com', 'meituan.com', 'ele.me',
            'dingtalk.com', 'aliwork.com', 'youzan.com',
            'weidian.com', 'xiaoe-tech.com', 'koudaitong.com',
            'weimob.com', 'jinritemai.com'
          ],
          pathPatterns: [
            '/mail', '/email', '/inbox', '/message',
            '/meeting', '/meet', '/call', '/conference', '/calendar',
            '/task', '/project', '/board', '/workspace', '/team',
            '/office', '/work', '/business', '/company', '/corp',
            '/hr', '/recruit', '/career', '/job', '/resume',
            '/admin', '/manage', '/settings', '/dashboard',
            '/report', '/analytics', '/stats', '/crm', '/erp'
          ],
          titleKeywords: [
            '邮件', 'email', 'mail', 'inbox', '消息', 'message',
            '会议', 'meeting', 'zoom', 'teams', '日程', 'calendar',
            '任务', 'task', '项目', 'project', '看板', 'board',
            '工作', 'work', 'office', '办公', '商务', 'business',
            '公司', 'company', '企业', 'corp', '团队', 'team',
            '协作', 'collaboration', 'OA', '系统', 'system',
            '管理', 'manage', '后台', 'admin', '控制台', 'console',
            '报表', 'report', '分析', 'analytics', '数据', 'data',
            '招聘', 'recruit', '求职', 'job', '简历', 'resume',
            '面试', 'interview', 'offer', '入职', 'onboarding'
          ],
          timePatterns: {
            weekday: [9, 10, 11, 14, 15, 16, 17],
            weekend: []
          }
        },
        weight: 1.0
      },
      
      development: {
        name: '开发',
        icon: '💻',
        color: '#7B1FA2',
        description: '代码开发、API文档、技术学习',
        patterns: {
          domains: [
            'github.com', 'gitlab.com', 'bitbucket.org',
            'gitee.com', 'coding.net', 'gitcode.com', 'gitea.io',
            'stackoverflow.com', 'stackexchange.com', 'serverfault.com',
            'superuser.com', 'askubuntu.com', 'unix.stackexchange.com',
            'npmjs.com', 'npmjs.org', 'yarnpkg.com', 'pnpm.io',
            'pypi.org', 'pip.pypa.io', 'rubygems.org', 'crates.io',
            'pub.dev', 'maven.apache.org', 'mvnrepository.com',
            'nuget.org', 'packagist.org', 'go.dev', 'pkg.go.dev',
            'deno.land', 'nodejs.org', 'python.org', 'java.com',
            'jetbrains.com', 'visualstudio.com', 'code.visualstudio.com',
            'docker.com', 'hub.docker.com', 'kubernetes.io',
            'amazon.com', 'aws.amazon.com', 'console.aws.amazon.com',
            'azure.com', 'portal.azure.com', 'cloud.google.com',
            'cloud.tencent.com', 'console.cloud.tencent.com',
            'aliyun.com', 'developer.aliyun.com',
            'huaweicloud.com', 'developer.huaweicloud.com',
            'developer.mozilla.org', 'mdn.io', 'w3schools.com',
            'w3.org', 'caniuse.com', 'caniuse.dev',
            'babeljs.io', 'webpack.js.org', 'vitejs.dev',
            'rollupjs.org', 'parceljs.org', 'jestjs.io',
            'testing-library.com', 'cypress.io', 'playwright.dev',
            'postman.com', 'insomnia.rest', 'swagger.io', 'openapi.org',
            'graphql.org', 'apollographql.com', 'reactjs.org',
            'vuejs.org', 'cn.vuejs.org', 'angular.io', 'angular.cn',
            'svelte.dev', 'nextjs.org', 'nuxt.com', 'gatsbyjs.com',
            'remix.run', 'tailwindcss.com', 'getbootstrap.com',
            'mui.com', 'ant.design', 'element.eleme.io',
            'arco.design', 'tdesign.tencent.com',
            'juejin.cn', 'segmentfault.com', 'oschina.net',
            'v2ex.com', 'cnblogs.com', 'csdn.net', 'itpub.net',
            '51cto.com', 'ibm.com/developerworks',
            'infoq.com', 'infoq.cn', '36kr.com', 'huxiu.com',
            'geekbang.org', 'time.geekbang.org',
            '极客时间', '极客邦', 'tutorialspoint.com',
            'digitalocean.com', 'linode.com', 'heroku.com',
            'vercel.com', 'netlify.com', 'cloudflare.com',
            'fastly.com', 'nginx.org', 'apache.org',
            'mysql.com', 'postgresql.org', 'mongodb.com',
            'redis.io', 'elasticsearch.org', 'rabbitmq.com',
            'kafka.apache.org', 'zookeeper.apache.org',
            'prometheus.io', 'grafana.com', 'datadoghq.com',
            'newrelic.com', 'sentry.io', 'bugsnag.com',
            'terraform.io', 'ansible.com', 'puppet.com',
            'chef.io', 'saltproject.org', 'jenkins.io',
            'gitlab-ci', 'circleci.com', 'travis-ci.org',
            'github.io', 'pages.dev', 'netlify.app'
          ],
          pathPatterns: [
            '/code', '/src', '/source', '/repo', '/repository',
            '/api', '/docs', '/documentation', '/developers',
            '/developer', '/dev', '/console', '/admin',
            '/pipeline', '/ci', '/cd', '/build', '/deploy',
            '/test', '/debug', '/log', '/logs', '/monitor',
            '/issue', '/issues', '/pull', '/pr', '/merge',
            '/commit', '/branch', '/tag', '/release', '/wiki',
            '/tutorial', '/guide', '/learn', '/course',
            '/framework', '/library', '/package', '/module',
            '/plugin', '/extension', '/api-reference', '/sdk'
          ],
          titleKeywords: [
            '代码', 'code', '源码', 'source', '编程', 'program',
            '开发', 'developer', '开发', 'dev', '技术', 'tech',
            'API', '接口', '文档', 'docs', 'documentation',
            '框架', 'framework', '库', 'library', '包', 'package',
            '部署', 'deploy', '构建', 'build', '测试', 'test',
            '调试', 'debug', 'Git', 'GitHub', 'GitLab', 'Gitee',
            'Docker', 'Kubernetes', '容器', 'container',
            '服务器', 'server', '云服务', 'cloud', '数据库',
            'mysql', 'postgres', 'mongodb', 'redis', '缓存',
            '前端', 'frontend', '后端', 'backend', '全栈', 'fullstack',
            '架构', 'architecture', '设计模式', 'design pattern',
            '算法', 'algorithm', '数据结构', 'data structure',
            '性能优化', 'performance', '安全', 'security', '网络',
            '操作系统', 'OS', 'Linux', 'Unix', 'Windows', 'macOS'
          ],
          timePatterns: {
            weekday: [10, 11, 14, 15, 16, 19, 20, 21],
            weekend: [10, 11, 14, 15, 16, 19, 20, 21, 22]
          }
        },
        weight: 1.0
      },
      
      learning: {
        name: '学习',
        icon: '📚',
        color: '#388E3C',
        description: '课程学习、教程文档、研究阅读',
        patterns: {
          domains: [
            'coursera.org', 'edx.org', 'udemy.com', 'lynda.com',
            'pluralsight.com', 'skillshare.com', 'masterclass.com',
            'khanacademy.org', 'codecademy.com', 'freecodecamp.org',
            'theodinproject.com', 'sololearn.com', 'datacamp.com',
            'teamtreehouse.com', 'codewars.com', 'hackerrank.com',
            'leetcode.com', 'lintcode.com', 'nowcoder.com',
            'acwing.com', 'pintia.cn', 'openjudge.cn',
            'edx.org', 'classcentral.com', 'mooc.cn',
            'icourse163.org', 'icourses.cn', 'xuetangx.com',
            'chinesemooc.org', 'eol.cn', 'study.163.com',
            'ke.qq.com', 'class.hujiang.com', 'hujiang.com',
            'tmooc.cn', 'zhihuishu.com', 'chaoxing.com',
            'fanya.chaoxing.com', 'i.chaoxing.com',
            'cnki.net', 'wanfangdata.com.cn', 'cqvip.com',
            'pubmed.ncbi.nlm.nih.gov', 'arxiv.org', 'researchgate.net',
            'academia.edu', 'ieee.org', 'acm.org', 'nature.com',
            'science.org', 'sciencedirect.com', 'springer.com',
            'wiley.com', 'tandfonline.com', 'taylorfrancis.com',
            'jstor.org', 'oxfordjournals.org', 'cambridge.org',
            'britannica.com', 'wikipedia.org', 'zh.wikipedia.org',
            'baike.baidu.com', 'baike.sogou.com', 'baike.qq.com',
            'zhihu.com', 'zhuanlan.zhihu.com',
            'douban.com', 'book.douban.com',
            'goodreads.com', 'librarything.com',
            'bookzz.org', 'gen.lib.rus.ec', 'sci-hub.se',
            'pdfdrive.com', 'z-library', 'b-ok.cc',
            'vocabulary.com', 'dictionary.com', 'thesaurus.com',
            'merriam-webster.com', 'oxforddictionaries.com',
            'dict.cn', 'iciba.com', 'youdao.com', 'fanyi.baidu.com',
            'duolingo.com', 'busuu.com', 'memrise.com',
            'ankiweb.net', 'quizlet.com', 'babbel.com',
            'rosettastone.com', 'lingualeo.com', 'polyglotclub.com'
          ],
          pathPatterns: [
            '/course', '/courses', '/lesson', '/learn', '/learning',
            '/tutorial', '/tutorials', '/guide', '/guides',
            '/study', '/education', '/edu', '/academic',
            '/module', '/chapter', '/unit', '/topic',
            '/quiz', '/test', '/exam', '/assessment', '/practice',
            '/exercise', '/homework', '/assignment', '/project',
            '/certificate', '/certification', '/diploma', '/degree',
            '/book', '/books', '/ebook', '/pdf', '/document',
            '/article', '/papers', '/journal', '/publication',
            '/research', '/study', '/thesis', '/dissertation',
            '/library', '/archive', '/collection', '/catalog'
          ],
          titleKeywords: [
            '课程', 'course', '教程', 'tutorial', '学习', 'learn',
            '教育', 'education', '学校', 'school', '大学', 'university',
            '学院', 'college', '课堂', 'class', '讲座', 'lecture',
            '章节', 'chapter', '单元', 'unit', '模块', 'module',
            '练习', 'exercise', '作业', 'homework', '测验', 'quiz',
            '考试', 'exam', '测试', 'test', '评估', 'assessment',
            '证书', 'certificate', '认证', 'certification', '学位',
            '书', 'book', '电子书', 'ebook', 'PDF', '文档',
            '文章', 'article', '论文', 'paper', '期刊', 'journal',
            '研究', 'research', '学术', 'academic', '学位论文',
            '图书馆', 'library', '档案馆', 'archive', '收藏',
            '词典', 'dictionary', '词汇', 'vocabulary', '翻译',
            '语言学习', 'language', '外语', 'foreign', '英语',
            '单词', 'word', '语法', 'grammar', '口语', '听力',
            '阅读', 'reading', '写作', 'writing', '翻译', 'translation'
          ],
          timePatterns: {
            weekday: [19, 20, 21, 22],
            weekend: [9, 10, 11, 14, 15, 16, 19, 20, 21]
          }
        },
        weight: 1.0
      },
      
      entertainment: {
        name: '娱乐',
        icon: '🎮',
        color: '#E64A19',
        description: '视频游戏、社交娱乐、购物休闲',
        patterns: {
          domains: [
            'youtube.com', 'youtu.be', 'bilibili.com', 'bilibili.cn',
            'iqiyi.com', 'youku.com', 'tudou.com', 'mgtv.com',
            'le.com', 'sohu.com', 'v.qq.com', 'letv.com',
            'netflix.com', 'hulu.com', 'disneyplus.com', 'hbo.com',
            'amazon.com', 'primevideo.com', 'tiktok.com', 'douyin.com',
            'kuaishou.com', 'xiaohongshu.com', 'ixigua.com',
            'toutiao.com', '36kr.com', 'huxiu.com', 'iyiou.com',
            'weibo.com', 'weibo.cn', 'qzone.qq.com', 'tieba.baidu.com',
            'mafengwo.cn', 'douban.com', 'zhihu.com',
            'facebook.com', 'fb.com', 'instagram.com', 'twitter.com',
            'x.com', 'pinterest.com', 'tumblr.com', 'reddit.com',
            'snapchat.com', 'linkedin.com', 'tinder.com',
            'steamcommunity.com', 'store.steampowered.com',
            'epicgames.com', 'gog.com', 'origin.com', 'ea.com',
            'ubisoft.com', 'blizzard.com', 'battle.net',
            'riotgames.com', 'leagueoflegends.com', 'dota2.com',
            'csgo.com', 'minecraft.net', 'roblox.com',
            'twitch.tv', 'gaming.youtube.com', 'mixer.com',
            'douyu.com', 'huya.com', 'longzhu.com', 'zhanqi.tv',
            'taobao.com', 'tmall.com', 'jd.com', 'pinduoduo.com',
            'yangkeduo.com', 'suning.com', 'gome.com.cn',
            'amazon.com', 'ebay.com', 'walmart.com', 'target.com',
            'aliexpress.com', 'alibaba.com', '1688.com',
            'shein.com', 'asos.com', 'zara.com', 'hm.com',
            'apple.com', 'samsung.com', 'mi.com', 'xiaomi.com',
            'music.163.com', 'qqmusic.com', 'kugou.com',
            'spotify.com', 'applemusic.com', 'music.apple.com',
            'soundcloud.com', 'bandcamp.com', 'deezer.com',
            'xiami.com', 'changba.com', '5sing.kugou.com',
            'acfun.cn', 'dilidili.com', 'dmhy.org',
            'manhua.dmzj.com', 'manhua.163.com', 'manhua.qq.com',
            'bilibili.com', 'bilibili.cn', 'pixiv.net',
            'deviantart.com', 'artstation.com', 'dribbble.com',
            'behance.net', 'huaban.com', 'zcool.com.cn'
          ],
          pathPatterns: [
            '/video', '/videos', '/watch', '/v/', '/movie', '/film',
            '/tv', '/show', '/episode', '/season', '/drama',
            '/anime', '/animation', '/cartoon', '/comic', '/manga',
            '/game', '/games', '/play', '/store', '/dlc',
            '/live', '/stream', '/broadcast', '/anchor', '/主播',
            '/social', '/community', '/forum', '/post', '/status',
            '/user', '/profile', '/follow', '/friend', '/message',
            '/shop', '/store', '/product', '/item', '/goods',
            '/cart', '/checkout', '/order', '/buy', '/purchase',
            '/music', '/song', '/album', '/playlist', '/artist',
            '/novel', '/book', '/story', '/chapter', '/阅读',
            '/travel', '/trip', '/tour', '/hotel', 'flight',
            '/food', '/restaurant', '/美食', '/recipe', 'cooking'
          ],
          titleKeywords: [
            '视频', 'video', '电影', 'movie', '电视剧', 'drama',
            '综艺', 'variety', '动漫', 'anime', '动画', 'animation',
            '游戏', 'game', '玩', 'play', '攻略', 'guide',
            '直播', 'live', 'stream', '主播', 'anchor',
            '社交', 'social', '社区', 'community', '论坛', 'forum',
            '微博', 'weibo', '朋友圈', '动态', 'post', 'status',
            '购物', 'shopping', '商品', 'product', '订单', 'order',
            '音乐', 'music', '歌曲', 'song', '歌单', 'playlist',
            '小说', 'novel', '书籍', 'book', '阅读', 'read',
            '旅行', 'travel', '旅游', 'tour', '酒店', 'hotel',
            '机票', 'flight', '美食', 'food', '餐厅', 'restaurant',
            '娱乐', 'entertainment', '休闲', 'leisure', '放松', 'relax'
          ],
          timePatterns: {
            weekday: [12, 18, 19, 20, 21, 22, 23],
            weekend: [9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
          }
        },
        weight: 1.0
      },
      
      life: {
        name: '生活',
        icon: '🏠',
        color: '#F57C00',
        description: '金融理财、健康医疗、旅行生活',
        patterns: {
          domains: [
            'icbc.com.cn', 'ccb.com', 'boc.cn', 'bankcomm.com',
            'abchina.com', 'psbc.com', 'citicbank.com',
            'cmbchina.com', 'cebbank.com', 'hxb.com.cn',
            'cmbc.com.cn', 'cib.com.cn', 'spdb.com.cn',
            'pingan.com', 'citibank.com', 'hsbc.com.cn',
            'standardchartered.com.cn', 'dbs.com.cn',
            'alipay.com', ' alipay.com', 'taobao.com', 'tmall.com',
            '95516.com', 'unionpay.com', 'chinapay.com',
            'weixin.qq.com', 'pay.weixin.qq.com', 'tenpay.com',
            'jdpay.com', 'jdfinance.com', 'lufax.com',
            'tdx.com.cn', 'gw.com.cn', '10jqka.com.cn',
            'eastmoney.com', 'xueqiu.com', 'gupiao.eastmoney.com',
            'hexun.com', 'jrj.com', 'stcn.com', 'cs.com.cn',
            'p2p.hexun.com', 'wdzj.com', 'wdzx.com.cn',
            'zhiping.com', 'rong360.com', 'dianrong.com',
            'lendingclub.com', 'prosper.com', 'kiva.org',
            'dxy.cn', 'haodf.com', 'guahao.com', 'jkb.com',
            '39.net', '99.com.cn', '120.net', 'medsci.cn',
            'pubmed.ncbi.nlm.nih.gov', 'webmd.com', 'mayoclinic.org',
            'nhs.uk', 'who.int', 'cdc.gov', 'nhc.gov.cn',
            'ctrip.com', 'qunar.com', 'tuniu.com', 'lvmama.com',
            'mafengwo.cn', 'flickr.com', 'yelp.com',
            'tripadvisor.com', 'tripadvisor.cn', 'agoda.com',
            'booking.com', 'airbnb.com', 'airbnb.cn', 'expedia.com',
            'skyscanner.com', 'kayak.com', 'momondo.com',
            'meituan.com', 'dianping.com', 'nuomi.com', 'ele.me',
            'koubei.com', 'amap.com', 'map.baidu.com',
            'map.qq.com', 'map.sogou.com', 'map.baidu.com',
            'weather.com', 'weather.com.cn', 'moji.com',
            'aqistudy.cn', 'pm25.com', 'tianqi.com',
            '58.com', 'ganji.com', 'zhilian.com', 'fang.com',
            'lianjia.com', 'ke.com', 'anjuke.com', 'centanet.com',
            'taobao.com', 'xianyu.com', 'zhuanzhuan.com',
            'gov.cn', '12306.cn', '12345.gov.cn',
            'chsi.com.cn', 'neea.edu.cn', 'cet.edu.cn',
            'ncre.edu.cn', 'zikao.com.cn', 'chengkao365.com',
            'mi.com', 'jd.com', 'suning.com', 'gome.com.cn',
            'car.autohome.com.cn', 'xcar.com.cn', 'yiche.com',
            'pcauto.com.cn', 'autohome.com.cn', 'newmotor.com.cn'
          ],
          pathPatterns: [
            '/bank', '/finance', '/money', '/invest', '/investment',
            '/stock', '/fund', '/loan', '/insurance', '/credit',
            '/pay', '/payment', '/wallet', '/account', '/transfer',
            '/health', '/medical', '/hospital', '/doctor', '/clinic',
            '/medicine', '/drug', '/pharmacy', '/symptom', '/disease',
            '/travel', '/trip', '/tour', '/vacation', '/holiday',
            '/hotel', '/flight', '/train', '/ticket', '/booking',
            '/map', '/location', '/address', '/route', '/navigation',
            '/weather', '/forecast', '/climate', '/environment',
            '/house', '/home', '/apartment', '/rent', '/buy',
            '/car', '/vehicle', '/auto', '/maintenance', '/repair',
            '/family', '/life', '/lifestyle', '/parenting', '/baby'
          ],
          titleKeywords: [
            '银行', 'bank', '金融', 'finance', '理财', 'wealth',
            '投资', 'invest', '股票', 'stock', '基金', 'fund',
            '保险', 'insurance', '贷款', 'loan', '信用卡', 'credit',
            '支付', 'pay', '付款', 'payment', '钱包', 'wallet',
            '转账', 'transfer', '账户', 'account', '余额', 'balance',
            '健康', 'health', '医疗', 'medical', '医院', 'hospital',
            '医生', 'doctor', '挂号', 'appointment', '药品', 'drug',
            '症状', 'symptom', '疾病', 'disease', '体检', 'checkup',
            '旅行', 'travel', '旅游', 'tour', '酒店', 'hotel',
            '机票', 'flight', '火车票', 'train', '门票', 'ticket',
            '地图', 'map', '地址', 'address', '路线', 'route',
            '导航', 'navigation', '天气', 'weather', '预报', 'forecast',
            '房子', 'house', '租房', 'rent', '买房', 'buy',
            '中介', 'agent', '房产', 'property', '房价', 'price',
            '汽车', 'car', '车辆', 'vehicle', '保养', 'maintenance',
            '维修', 'repair', '加油', 'gas', '停车', 'parking',
            '生活', 'life', '家庭', 'family', '育儿', 'parenting',
            '美食', 'food', '烹饪', 'cooking', '菜谱', 'recipe'
          ],
          timePatterns: {
            weekday: [12, 18, 19, 20, 21],
            weekend: [9, 10, 11, 14, 15, 16, 17, 18, 19]
          }
        },
        weight: 1.0
      }
    };

    console.log('🎭 SceneClassifier initialized with', Object.keys(this.scenePatterns).length, 'scenes');
  }

  // ========== 自定义场景管理 ==========

  addCustomScene(sceneName, config) {
    const sceneKey = sceneName.toLowerCase().replace(/\s+/g, '_');
    
    this.customScenePatterns.set(sceneKey, {
      name: config.name || sceneName,
      icon: config.icon || '📁',
      color: config.color || '#607D8B',
      description: config.description || '用户自定义场景',
      patterns: {
        domains: config.domains || [],
        pathPatterns: config.pathPatterns || [],
        titleKeywords: config.titleKeywords || []
      },
      weight: config.weight || 1.0,
      isCustom: true
    });

    if (config.priority !== undefined) {
      this.scenePriorities.set(sceneKey, config.priority);
    }

    console.log('➕ Added custom scene:', sceneName);
    return true;
  }

  removeCustomScene(sceneName) {
    const sceneKey = sceneName.toLowerCase().replace(/\s+/g, '_');
    const removed = this.customScenePatterns.delete(sceneKey);
    this.scenePriorities.delete(sceneKey);
    
    if (removed) {
      console.log('➖ Removed custom scene:', sceneName);
    }
    return removed;
  }

  setScenePriority(sceneName, priority) {
    const sceneKey = sceneName.toLowerCase().replace(/\s+/g, '_');
    this.scenePriorities.set(sceneKey, priority);
    console.log('⚖️ Set priority for', sceneName, ':', priority);
  }

  setUserSceneWeight(sceneName, weight) {
    const sceneKey = sceneName.toLowerCase().replace(/\s+/g, '_');
    this.userSceneWeights.set(sceneKey, Math.max(0, Math.min(2, weight)));
    console.log('📊 Set user weight for', sceneName, ':', weight);
  }

  // ========== 场景分类核心方法 ==========

  classify(tab, options = {}) {
    const url = tab.url || '';
    const title = tab.title || '';
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const scores = new Map();
    const matches = [];

    for (const [type, config] of Object.entries(this.scenePatterns)) {
      const score = this.calculateSceneScore(url, title, config, hour, isWeekend);
      const userWeight = this.userSceneWeights.get(type) || 1;
      const finalScore = score * userWeight;

      if (finalScore > 0) {
        scores.set(type, finalScore);
        matches.push({
          type,
          score: finalScore,
          name: config.name,
          icon: config.icon,
          color: config.color,
          description: config.description,
          priority: this.scenePriorities.get(type) || 0
        });
      }
    }

    for (const [type, config] of this.customScenePatterns.entries()) {
      const score = this.calculateSceneScore(url, title, config, hour, isWeekend);
      const userWeight = this.userSceneWeights.get(type) || 1;
      const finalScore = score * userWeight;

      if (finalScore > 0) {
        scores.set(type, finalScore);
        matches.push({
          type,
          score: finalScore,
          name: config.name,
          icon: config.icon,
          color: config.color,
          description: config.description,
          priority: this.scenePriorities.get(type) || 0,
          isCustom: true
        });
      }
    }

    matches.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.1) {
        return b.score - a.score;
      }
      return (b.priority || 0) - (a.priority || 0);
    });

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

  calculateSceneScore(url, title, config, hour, isWeekend) {
    const patterns = config.patterns;
    const baseWeight = config.weight || 1;
    let totalScore = 0;

    if (!patterns) return 0;

    const domainScore = this.matchDomain(url, patterns.domains || []);
    totalScore += domainScore * 0.5;

    const pathScore = this.matchPath(url, patterns.pathPatterns || []);
    totalScore += pathScore * 0.25;

    const titleScore = this.matchTitle(title, patterns.titleKeywords || []);
    totalScore += titleScore * 0.2;

    const timeScore = this.matchTime(hour, isWeekend, patterns.timePatterns);
    totalScore += timeScore * 0.05;

    return Math.min(totalScore * baseWeight, 1);
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
    return Math.min(matchCount / Math.max(1, Math.floor(keywords.length * 0.25)), 1);
  }

  matchTime(hour, isWeekend, timePatterns) {
    if (!timePatterns) return 0;

    const targetHours = isWeekend 
      ? (timePatterns.weekend || [])
      : (timePatterns.weekday || []);

    if (targetHours.length === 0) return 0.5;

    for (const targetHour of targetHours) {
      if (hour === targetHour || (hour >= targetHour - 1 && hour <= targetHour + 1)) {
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
      
      if (result.score > 0.25) {
        const key = result.type;
        if (!groups.has(key)) {
          groups.set(key, {
            id: `scene_${key}`,
            name: result.name,
            type: 'scene',
            sceneType: key,
            icon: result.icon,
            color: result.color,
            description: result.description,
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
        id: 'scene_other',
        name: '其他',
        type: 'scene',
        sceneType: 'other',
        icon: '🌐',
        color: '#607D8B',
        tabs: ungrouped,
        collapsed: false,
        createdAt: Date.now()
      });
    }

    return resultGroups;
  }

  // ========== 获取场景信息 ==========

  getScenes() {
    const scenes = [];
    
    for (const [type, config] of Object.entries(this.scenePatterns)) {
      scenes.push({
        type,
        name: config.name,
        icon: config.icon,
        color: config.color,
        description: config.description,
        priority: this.scenePriorities.get(type) || 0,
        userWeight: this.userSceneWeights.get(type) || 1,
        isCustom: false
      });
    }

    for (const [type, config] of this.customScenePatterns.entries()) {
      scenes.push({
        type,
        name: config.name,
        icon: config.icon,
        color: config.color,
        description: config.description,
        priority: this.scenePriorities.get(type) || 0,
        userWeight: this.userSceneWeights.get(type) || 1,
        isCustom: true
      });
    }

    return scenes.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  getSceneInfo(type) {
    let config = this.scenePatterns[type];
    let isCustom = false;

    if (!config) {
      config = this.customScenePatterns.get(type);
      isCustom = true;
    }

    if (!config) return null;

    return {
      type,
      name: config.name,
      icon: config.icon,
      color: config.color,
      description: config.description,
      patterns: config.patterns,
      weight: config.weight,
      priority: this.scenePriorities.get(type) || 0,
      userWeight: this.userSceneWeights.get(type) || 1,
      isCustom
    };
  }

  // ========== 持久化 ==========

  async saveToStorage(storageManager) {
    const data = {
      customScenePatterns: Object.fromEntries(this.customScenePatterns),
      scenePriorities: Object.fromEntries(this.scenePriorities),
      userSceneWeights: Object.fromEntries(this.userSceneWeights)
    };

    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'tabflow:scene_config': data }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      console.log('💾 Scene config saved');
      return true;
    } catch (error) {
      console.error('❌ Failed to save scene config:', error);
      return false;
    }
  }

  async loadFromStorage() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:scene_config', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      const data = result['tabflow:scene_config'];
      if (data) {
        if (data.customScenePatterns) {
          for (const [key, value] of Object.entries(data.customScenePatterns)) {
            this.customScenePatterns.set(key, value);
          }
        }
        if (data.scenePriorities) {
          for (const [key, value] of Object.entries(data.scenePriorities)) {
            this.scenePriorities.set(key, value);
          }
        }
        if (data.userSceneWeights) {
          for (const [key, value] of Object.entries(data.userSceneWeights)) {
            this.userSceneWeights.set(key, value);
          }
        }
        console.log('📥 Scene config loaded');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Failed to load scene config:', error);
      return false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SceneClassifier;
}

if (typeof window !== 'undefined') {
  window.SceneClassifier = SceneClassifier;
}
