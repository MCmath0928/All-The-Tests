/* ==========================================================================
   All The Tests — 数据注册中心
   --------------------------------------------------------------------------
   本文件定义：分类体系、来源站登记表、去重簇、以及 add() 注册接口。
   各 data/*.js 文件通过 ATT.add(...) 把自己的量表挂进来。
   ========================================================================== */
window.ATT = window.ATT || {};
(function (A) {

  /* ------------------------------------------------------------------ *
   * 1. 分类体系（15 类，覆盖正式量表与娱乐测试）
   * ------------------------------------------------------------------ */
  A.cats = [
    { id:'personality', cn:'人格与性格',      en:'Personality & Traits',        emoji:'🧩',
      desc:'大五 / HEXACO / MBTI 式类型学 / 暗黑人格 / 气质类型——相对稳定的个体差异。',
      keys:['大五','HEXACO','MBTI','九型','DISC','暗黑三角','气质','人格障碍'] },
    { id:'mood',        cn:'情绪与心境',      en:'Mood & Emotion',              emoji:'🌊',
      desc:'抑郁、焦虑、压力、愤怒、情绪调节——当下情绪状态的标准化自评。',
      keys:['抑郁','焦虑','压力','愤怒','情绪调节','心境'] },
    { id:'clinical',    cn:'临床筛查与症状',  en:'Clinical Screening',          emoji:'🩺',
      desc:'创伤、强迫、惊恐、进食、精神病性体验等症状筛查。仅供筛查参考，不能替代诊断。',
      keys:['创伤','PTSD','强迫','惊恐','进食障碍','筛查'] },
    { id:'cognition',   cn:'智力与认知',      en:'Intelligence & Cognition',    emoji:'🧠',
      desc:'智力、工作记忆、注意力、执行功能、思维风格。正式智力测验需专业主试，此处以自评与短测为主。',
      keys:['IQ','智力','认知','注意力','执行功能','思维'] },
    { id:'relationship',cn:'关系与依恋',      en:'Attachment & Relationships',  emoji:'🔗',
      desc:'成人依恋、人际边界、社交焦虑、孤独感、共情与沟通模式。',
      keys:['依恋','社交焦虑','孤独','共情','边界','沟通'] },
    { id:'love',        cn:'爱情与婚恋',      en:'Love & Romance',              emoji:'💞',
      desc:'爱情风格、爱的语言、关系满意度、亲密关系中的权力与冲突。',
      keys:['爱情','婚恋','亲密关系','满意度','爱的语言'] },
    { id:'career',      cn:'职业与学业',      en:'Career & Study',              emoji:'🎯',
      desc:'兴趣代码、职业锚、领导风格、团队角色、学习方式、拖延与时间管理。',
      keys:['霍兰德','RIASEC','职业锚','领导力','学习风格','拖延'] },
    { id:'health',      cn:'身心与睡眠',      en:'Health & Sleep',              emoji:'🌙',
      desc:'睡眠质量、疲劳、躯体化症状、慢性疼痛、健康行为。',
      keys:['睡眠','失眠','疲劳','躯体化','健康'] },
    { id:'selff',       cn:'自我与成长',      en:'Self & Growth',               emoji:'🌱',
      desc:'自尊、自我效能、自悯、羞耻、冒名顶替感、心理韧性、应对方式。',
      keys:['自尊','自我效能','自悯','韧性','应对','羞耻'] },
    { id:'wellbeing',   cn:'优势与幸福',      en:'Strengths & Wellbeing',       emoji:'☀️',
      desc:'性格优势、生活满意度、主观幸福感、乐观、感恩、意义感、心流。',
      keys:['优势','幸福感','生活满意度','乐观','感恩','意义'] },
    { id:'neuro',       cn:'神经多样性与发展',en:'Neurodiversity',             emoji:'🧬',
      desc:'ADHD、孤独症谱系、读写困难、高敏感等神经类型特质筛查。',
      keys:['ADHD','孤独症','ASD','高敏感','神经多样性'] },
    { id:'addiction',   cn:'成瘾与数字行为',  en:'Addiction & Digital Behavior',emoji:'📱',
      desc:'酒精、烟草、赌博、网络与手机使用、游戏障碍等行为成瘾风险。',
      keys:['成瘾','网络','手机','游戏','酒精','赌博'] },
    { id:'values',      cn:'价值观与态度',    en:'Values & Attitudes',          emoji:'🧭',
      desc:'价值观取向、道德基础、政治倾向、时间观、控制点、金钱观。',
      keys:['价值观','道德','政治','时间观','控制点'] },
    { id:'youth',       cn:'儿童与青少年',    en:'Children & Adolescents',      emoji:'🧒',
      desc:'儿童行为与情绪、亲子关系、教养方式。多数需家长或教师报告。',
      keys:['儿童','青少年','亲子','教养','发展'] },
    { id:'fun',         cn:'娱乐与趣味',      en:'Fun & Just-for-Fun',          emoji:'🎲',
      desc:'社交电量、恋爱脑、拖延症、熬夜、摸鱼……非临床、纯娱乐的自我投射型测试。',
      keys:['娱乐','社交','拖延','熬夜','人格动物','趣味'] }
  ];

  /* ------------------------------------------------------------------ *
   * 2. 来源站登记表
   *    cn  : 中国大陆常规网络环境下可直接访问（无需特殊工具）
   *    free: 完成测试本身不需要付费
   *    reg : 需要注册账号
   * ------------------------------------------------------------------ */
  A.sources = {
    /* —— 量表原始出处 / 学术公开题库 —— */
    phqscreeners:{ name:'PHQ Screeners（辉瑞官方）', url:'https://www.phqscreeners.com/', cn:true, free:true,
      note:'PHQ-9 / GAD-7 / PHQ-15 等量表官方发布页，提供多语言版本，明确允许免费用于临床、研究与教育。' },
    ipip:{ name:'IPIP 国际人格题库（ipip.ori.org）', url:'https://ipip.ori.org/', cn:true, free:true,
      note:'国际人格项目库，全部题目属公共领域（public domain），可自由使用与翻译。' },
    whoAsrs:{ name:'WHO / 成人 ADHD 自评量表 ASRS v1.1', url:'https://www.hcp.med.harvard.edu/ncs/asrs.php', cn:true, free:true,
      note:'世界卫生组织成人 ADHD 自评量表官方页，附计分说明，公共可免费使用。' },
    fraleyEcr:{ name:'R. Chris Fraley 依恋量表页（ECR-R / CRQ）', url:'https://labs.psychology.illinois.edu/~rcfraley/measures/measures.html', cn:true, free:true,
      note:'ECR-R、CRQ 等成人依恋量表的作者公开页，题目与计分方式全部开放，供研究免费使用。' },
    vaPcl5:{ name:'美国退伍军人事务部 PTSD 量表页（PCL-5）', url:'https://www.ptsd.va.gov/professional/assessment/adult-sr/ptsd-checklist.asp', cn:true, free:true,
      note:'PCL-5 官方发布页，公共领域，可自由复制使用。' },
    spspScales:{ name:'SPSP 心理量表汇集', url:'https://spsp.org/about/tools/scales', cn:true, free:true,
      note:'美国人格与社会心理学会整理的公开量表索引。' },
    psyTestsYork:{ name:'York University 心理学量表库', url:'https://www.yorku.ca/rokada/psyctest/', cn:true, free:true,
      note:'经典社会心理学量表题目与计分说明的公开归档（Roland K. Yoshida 整理）。' },

    /* —— 大型综合测试平台 —— */
    idrlabs:{ name:'IDRlabs 心理测试', url:'https://www.idrlabs.com/', zh:true, cn:true, free:true,
      note:'数百个免费测试（含中文界面 idrlabs.com/cn/），无需注册，涵盖正式量表改编与趣味测试。' },
    openpsy:{ name:'Open Psychometrics', url:'https://openpsychometrics.org/', cn:true, free:true,
      note:'开源心理测量项目，提供 IPIP 大五、暗黑人格、依恋等测试的完整题本与统计报告。' },
    '16p':{ name:'16Personalities（16型人格）', url:'https://www.16personalities.com/ch', zh:true, cn:true, free:true,
      note:'中文界面可用，完整测试与报告免费；其模型为 NERIS 四维（非正统 MBTI，维度与判据自成体系）。' },
    truity:{ name:'Truity', url:'https://www.truity.com/', cn:false, free:false,
      note:'部分测试免费，详细报告（如大五完整版、Holland 职业报告）为付费，且大陆访问不稳定。' },
    psyToday:{ name:'Psychology Today Tests', url:'https://www.psychologytoday.com/us/tests', cn:false, free:false,
      note:'数百个测试，简短结果免费，完整报告付费；站点在大陆访问不稳定。' },
    humanmetrics:{ name:'HumanMetrics', url:'https://www.humanmetrics.com/', cn:true, free:true,
      note:'老牌免费 MBTI 式（Jung Typology）与 DISC 测试站。' },
    similarminds:{ name:'SimilarMinds', url:'https://similarminds.com/', cn:true, free:true,
      note:'提供大量公开改编量表（大五、九型、暗黑三角等）的免费测试。' },
    '123test':{ name:'123test', url:'https://www.123test.com/', cn:true, free:true,
      note:'免费智力、人格、职业测试，部分深度报告付费。' },
    arealme:{ name:'A Real Me（中文站）', url:'https://www.arealme.com/zh/', zh:true, cn:true, free:true,
      note:'娱乐向测试集合，中文界面，全部免费，社交传播友好。' },
    ecclEnnea:{ name:'Eclectic Energies 九型人格', url:'https://www.eclecticenergies.com/enneagram/', cn:true, free:true,
      note:'免费九型人格测试与详细类型描述，经典公开版本。' },
    viaChar:{ name:'VIA 性格优势（VIA Institute）', url:'https://www.viacharacter.org/', cn:true, free:true, reg:true,
      note:'VIA-IS 性格优势测验免费，但需注册账号；有中文界面。' },
    authentHappiness:{ name:'Authentic Happiness（宾大）', url:'https://www.authentichappiness.sas.upenn.edu/', cn:false, free:true, reg:true,
      note:'宾大积极心理学中心量表库（Seligman 团队），注册后免费，含多个经典量表；大陆访问不稳定。' },
    onetIP:{ name:'O*NET Interest Profiler（美国劳工部）', url:'https://www.mynextmove.org/explore/ip', cn:true, free:true,
      note:'霍兰德 RIASEC 兴趣测评的官方公共领域版本，60 题免费，附职业数据库。' },
    onetMNC:{ name:'O*NET My Next Move（职业检索）', url:'https://www.mynextmove.org/', cn:true, free:true,
      note:'与兴趣测评配套的职业探索工具，公共领域。' },
    emsi:{ name:'Enneagram Institute', url:'https://www.enneagraminstitute.com/', cn:true, free:false,
      note:'官方 RHETI 测试付费（约 12 美元）；类型描述页免费可读。' },
    mbtiOfficial:{ name:'The Myers-Briggs Company（MBTI 官方）', url:'https://www.themyersbriggs.com/', cn:true, free:false,
      note:'MBTI 正版测评必须由认证施测师进行，付费且需培训资质；无法免费获得。' },
    discProfile:{ name:'DISC Profile（官方）', url:'https://www.discprofile.com/', cn:true, free:false,
      note:'Everything DiSC 正式报告付费；官网提供有限的免费样题体验。' },
    fiveLove:{ name:'The 5 Love Languages（爱的五种语言）', url:'https://5lovelanguages.com/quizzes', cn:true, free:true,
      note:'官方免费测验，需邮箱换取结果；中文版书籍同名量表广为流传。' },
    understandMyself:{ name:'Understand Myself（Peterson 大五）', url:'https://www.understandmyself.com/', cn:false, free:false,
      note:'十维度大五报告付费（约 10 美元），大陆访问不稳定。' },
    mensaNo:{ name:'Mensa Norway 在线 IQ 测试', url:'https://test.mensa.no/', cn:true, free:true,
      note:'挪威门萨官方免费 35 题矩阵推理测验，无文化偏差设计，是少见的官方免费智力测验。' },
    mensaDK:{ name:'Mensa Denmark 在线 IQ 测试', url:'https://www.mensa.dk/test/', cn:true, free:true,
      note:'丹麦门萨免费 39 题测验，同样为官方发布。' },
    psychometricly:{ name:'Psychometricly', url:'https://psychometricly.com/', cn:true, free:true,
      note:'免费心理测量测验集合，界面简洁。' },

    /* —— 中文平台 —— */
    xinli001:{ name:'壹心理 · 心理测评', url:'https://www.xinli001.com/ceping', zh:true, cn:true, free:false,
      note:'国内最大心理社区，测评中心有大量量表；部分免费（如抑郁自评、MBTI 简版），深度报告多为付费。' },
    psyctest:{ name:'PsycTest 免费在线心理测试', url:'https://w.psyctest.cn/', zh:true, cn:true, free:true,
      note:'中文免费测试平台，提供 MMPI、SCL-90、16PF 等经典量表的在线作答与计分，简体界面。' },
    psy525:{ name:'525 心理网 · 心理测试', url:'https://www.psy525.cn/ceshi/', zh:true, cn:true, free:true,
      note:'国内老牌心理测试频道，SCL-90、SDS、SAS 等经典量表可免费作答。' },
    apesk:{ name:'APESK 心理测评', url:'https://www.apesk.com/', zh:true, cn:true, free:false,
      note:'国内知名 MBTI / 九型 / 大五测评站，简版免费、完整报告付费。' },
    wjx:{ name:'问卷星', url:'https://www.wjx.cn/', zh:true, cn:true, free:true,
      note:'通用问卷平台，大量高校与机构把量表做成公开问卷，搜"大五人格""SCL-90"可找到免费作答入口。' },
    jiandanxinli:{ name:'简单心理', url:'https://www.jiandanxinli.com/', zh:true, cn:true, free:false,
      note:'心理咨询平台，测评与课程多为付费，量表科普文章质量较高。' },
    zhihuTest:{ name:'知乎 · 心理测试话题', url:'https://www.zhihu.com/topic/19551654/hot', zh:true, cn:true, free:true,
      note:'中文互联网上测试索引与量表翻译讨论最密集的地方，可用来交叉核对题目译文。' },
    psyCsu:{ name:'中国大学生心理健康测评系统', url:'https://psy.csu.edu.cn/', zh:true, cn:true, free:true,
      note:'高校系统内使用的 UPI、SCL-90、16PF 测评入口，通常需学校账号，仅作参考。' },
    /* —— 具体量表的官方发布页 —— */
    dass:{ name:'DASS-21 官方量表页（新南威尔士大学）', url:'https://www2.psy.unsw.edu.au/dass/', cn:false, free:true,
      note:'抑郁-焦虑-压力量表官方发布页，量表可免费用于非商业研究；英文站在大陆访问不稳定，故本站自建中文版。' },
    pss:{ name:'知觉压力量表 PSS（卡内基梅隆大学）', url:'https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/index.html', cn:true, free:true,
      note:'Cohen 知觉压力量表官方页，提供 PSS-14 / PSS-10 / PSS-4 多语言版本，免费非商业使用。' },
    whoAudit:{ name:'WHO 酒精使用障碍筛查量表 AUDIT', url:'https://www.who.int/publications/i/item/WHO-MSD-MSB-01.4a', cn:true, free:true,
      note:'世界卫生组织酒精筛查工具官方发布页，公共领域，可自由复制使用。' },
    greaterGood:{ name:'Greater Good 科学中心测验（UC Berkeley）', url:'https://greatergood.berkeley.edu/quizzes', cn:true, free:true,
      note:'加州大学伯克利分校至善科学中心的免费测验（共情、正念、感恩、幸福、韧性等），无需注册。' },
    psychCentral:{ name:'PsychCentral 自助测验', url:'https://psychcentral.com/quizzes', cn:true, free:true,
      note:'免费自助筛查测验集合，含 PHQ-9、GAD-7 等量表的改编在线版。' },
    pittSleep:{ name:'匹兹堡大学睡眠量表库（PSQI / ISI / ESS）', url:'https://www.sleep.pitt.edu/instruments', cn:false, free:true,
      note:'PSQI、ISI、ESS 等睡眠量表官方发布页，免费用于临床与研究；大陆访问不稳定，故本站自建。' },
    fraleyWeb:{ name:'Fraley 依恋量表在线施测页', url:'https://www.web-research-design.net/cgi-bin/crq/crq.pl', cn:false, free:true,
      note:'ECR-R / CRQ 作者提供的在线施测与即时反馈页，免费；大陆访问不稳定。' },
    cdRisc:{ name:'CD-RISC 心理韧性量表官网', url:'https://www.cd-risc.com/', cn:true, free:false,
      note:'Connor-Davidson 韧性量表官方站，学术与临床可免费申请，商业使用需授权。' },
    embraceAutism:{ name:'Embrace Autism（孤独症自评量表合集）', url:'https://embrace-autism.com/autism-tests/', cn:true, free:true,
      note:'汇集 AQ、RAADS-R、EQ、CAT-Q 等孤独症相关量表的在线版与常模对比，全部免费、无需注册。' },
    hsperson:{ name:'HSP 高敏感人群量表官网（Elaine Aron）', url:'https://hsperson.com/test/', cn:true, free:true,
      note:'Aron 博士官方 HSP 自评量表页，含成人版与儿童版，免费。' },
    whoAsrsPage:{ name:'WHO 成人 ADHD 自评量表 ASRS v1.1 官方页', url:'https://www.hcp.med.harvard.edu/ncs/asrs.php', cn:true, free:true,
      note:'世界卫生组织 ASRS v1.1 官方发布页，含 6 题筛查版与 18 题完整版及计分阈值。' },
    netaddiction:{ name:'Young 网络成瘾中心（IAT）', url:'https://www.netaddiction.com/', cn:true, free:true,
      note:'Kimberly Young 的 IAT 网络成瘾量表官方出处，题目与计分公开。' },
    cssrs:{ name:'哥伦比亚自杀严重程度评定量表 C-SSRS', url:'https://cssrs.columbia.edu/', cn:true, free:true,
      note:'C-SSRS 官方站，提供免费培训与多语言量表，公共可及。' },
    mindtools:{ name:'MindTools 职场技能测评', url:'https://www.mindtools.com/', cn:true, free:false, reg:true,
      note:'领导风格、时间管理、沟通、情商等上百个职场自评，测试本身可免费做，但工具与深度内容为会员制；题目为商业自编，非公开发表的心理量表。' },
    cbiNfa:{ name:'哥本哈根倦怠量表 CBI（丹麦国家工作环境研究中心 NFA）', url:'https://nfa.dk/vaerktoejer/spoergeskemaer/spoergeskema-til-maaling-af-udbraendthed-cbi/copenhagen-burnout-inventory-cbi/', cn:false, free:true,
      note:'CBI 官方发布页，作者授权免费用于非商业用途，提供多语言版本与完整题目。丹麦站点在中国大陆访问不稳定，故本站自建中文版。' },
    uwes:{ name:'Utrecht 工作投入量表 UWES（Wilmar Schaufeli 官方站）', url:'https://www.wilmarschaufeli.nl/tests/', cn:true, free:true,
      note:'作者官方站免费提供 UWES 各语言版本量表与测验手册（含中文版），供非商业研究使用；该站只给 PDF 不给在线施测，故本站另建站内作答版。' },
    mbi:{ name:'Maslach 职业倦怠量表 MBI（Mind Garden）', url:'https://www.mindgarden.com/', cn:true, free:false,
      note:'MBI 是职业倦怠研究中最常被引用的量表，但为商业产品，需向 Mind Garden 购买授权后才能使用；官网在中国大陆可访问，内容需付费。' },
    teique:{ name:'TEIQue 特质情商问卷（伦敦心理测量实验室）', url:'https://www.psychometriclab.com/', cn:true, free:true, reg:true,
      note:'K. V. Petrides 的特质情商模型官方站，学术研究可免费申请使用，提供多语言版本。' },
    mmpiCn:{ name:'中国心理卫生协会', url:'https://www.camh.org.cn/', zh:true, cn:true, free:true,
      note:'国内心理卫生行业组织，可用于核对量表中文常模与使用规范。' },
    mbtiCn:{ name:'MBTI 中文资料站（知乎专栏）', url:'https://zhuanlan.zhihu.com/p/2062903907488117466', zh:true, cn:true, free:true,
      note:'民间整理的免费 MBTI 测试站对比，可作为外链集合参考（内容非官方）。' },
    douban:{ name:'豆瓣 · 心理测试小组', url:'https://www.douban.com/group/xinliceshi/', zh:true, cn:true, free:true,
      note:'中文娱乐性心理测试的集散地，适合寻找趣味测试与中文译文。' }
  };

  /* ------------------------------------------------------------------ *
   * 3. 注册接口
   * ------------------------------------------------------------------ */
  A.tests = [];
  A.add = function () {
    for (var i = 0; i < arguments.length; i++) A.tests.push(arguments[i]);
    return A;
  };

  /* ------------------------------------------------------------------ *
   * 4. 去重簇（近义 / 同源 / 重复收录说明）
   *    每簇列出并入的条目 id，索引里只保留 canonical。
   * ------------------------------------------------------------------ */
  A.clusters = [
    { title:'职业倦怠与工作投入（Burnout / Engagement）',
      why:'MBI、CBI、BAT、OLBI、MBI-ES（学生版）测的是同一种状态：长期工作或学业压力导致的"耗竭—疏离—低效能"。它们之间高度相关，只是切分方式不同。MBI 是商业量表（Mind Garden，需付费授权），CBI 与 BAT 是免费公开的替代工具。UWES 测的是同一维度的反极——工作投入，常与倦怠一起使用。',
      keep:['cbi','uwes-9','student-burnout'],
      merged:['mbi-gs','mbi-hss','mbi-es','olbi','bat-23','职业倦怠量表','工作倦怠测试'],
      note:'本站保留 CBI（免费、题目公开、把"个人倦怠 / 工作倦怠 / 服务对象倦怠"拆开）作为工作倦怠代表，另提供 UWES-9（工作投入）与自编的《学业倦怠量表》面向学生。MBI 全系列因商业授权仅作说明性收录。' },

    { title:'大五人格（Big Five / Five-Factor）家族',
      why:'所有"大五"测试测的都是同一套维度结构（开放性、尽责性、外向性、宜人性、神经质），差别只在题库长度与版权：IPIP 题本属公共领域，NEO-PI-R / BFI-2 受版权保护，网上大量"免费大五"其实是 IPIP 的改写或翻译。',
      keep:['ipip-bigfive-50','openpsy-ipip-neo-120','bfi2','hexaco-60'],
      merged:['neo-pi-r','bigfive-50','bigfive-10','tipi','五因素人格问卷','大五人格简版','BFI-44'],
      note:'本站保留四个不同层级的代表：IPIP 50 题（公共领域 · 站内可做）、IPIP-NEO-120（公共领域 · 外链完整版）、BFI-2（学界现行主流 · 学术使用）、HEXACO-60（多出"诚实-谦逊"维度 · 官方在线版）。其余同名版本按重复处理。' },

    { title:'MBTI 及其全部"影子版本"',
      why:'MBTI 正版付费且需认证施测师；网上的免费"MBTI"实为四维倾向自评（Jung 类型学 / NERIS / 各种简版），题目、维度权重与判据各不相同，输出却都用四个字母，最容易造成"同一个测试"的错觉。',
      keep:['jung-16-type','neris-16p','mbti-official'],
      merged:['mbti-93','mbti-28','keirsey','socionics','JTI','荣格八维','MBTI简版'],
      note:'合并判据：输出为 4 字母类型码即视为同一家族；但 16Personalities 使用 NERIS（含 A/T 第五维），与荣格功能栈模型不同源，故单列。' },

    { title:'抑郁自评量表',
      why:'PHQ-9、CES-D、SDS（Zung）、BDI-II 都在测抑郁严重度。BDI-II 与 PHQ-9 高度相关（r≈0.8），CES-D 偏"抑郁情绪流行学筛查"，SDS 以 20 题的躯体-情绪混合形式呈现。',
      keep:['phq-9','dass-21','bdi-2','who-5'],
      merged:['ces-d','zung-sds','phq-2','sds-20','抑郁自评量表'],
      note:'PHQ-9 与 GAD-7 是同一套开发计划（Pfizer）的配套量表，且共用"过去两周"时间窗，故在情绪筛查入口中成对展示。BDI-II 因版权受限仅作说明性收录。' },

    { title:'焦虑自评量表',
      why:'GAD-7、STAI（状态-特质）、BAI、Zung SAS、HAMA 都在测焦虑。GAD-7 与 PHQ-9 结构同源，STAI 区分状态与特质，BAI 偏躯体症状。',
      keep:['gad-7','stai-sf'],
      merged:['zung-sas','bai','hama','gad-2','sas-20','stai-40','stai-state-20'],
      note:'"广泛性焦虑"与"社交焦虑"分属不同维度，因此 SPIN / LSAS 归入「关系与依恋」，不做合并。' },

    { title:'依恋类型测验',
      why:'ECR-R、ECR、RQ、AAS、AAI（访谈）、CRQ 测的都是成人依恋。差别在于维度模型（两维连续 vs 四类型分类）与施测方式（自评 vs 访谈）。',
      keep:['ecr-r','attachment-4type'],
      merged:['rq','aas','ecr-original','crq','adult-attachment-interview','依恋类型测试'],
      note:'ECR-R 输出两个连续维度（依恋焦虑 / 依恋回避），四类型测验输出分类标签，前者信息量更大；两者互不替代，故都保留，但不再收录其余同族版本。' },

    { title:'九型人格（Enneagram）',
      why:'RHETI、EQ-i 九型版、各类免费九型测试同测 9 种类型。差异主要在题量与是否包含侧翼（wing）与三中心（本能/情感/思考）判据。',
      keep:['enneagram-free','enneagram-eclectic','rheti'],
      merged:['enneagram-9types','九型人格简版','enneagram-wing-test'],
      note:'RHETI 官方版付费，故以公开版本自建。' },

    { title:'性格优势与美德',
      why:'VIA-IS、VIA-IS-P、Brief Strengths Test、Gallup StrengthsFinder 都在做优势排序。StrengthsFinder 是纯商业产品（需购书码），VIA 免费。',
      keep:['via-brief'],
      merged:['strengthsfinder','via-is-240','brief-strengths-test','优势识别器'],
      note:'StrengthsFinder 因必须购买访问码而不满足"免费"条件，且题库不公开，无法自建，故仅作说明性收录。' },

    { title:'暗黑三角（Dark Triad）',
      why:'SD3、Dirty Dozen、Short Dark Triad 中文版、Mach-IV、SRP、NPI 分测自恋/马基雅维利主义/精神病态。SD3 与 Dirty Dozen 测同一构念，仅题量不同。',
      keep:['sd3'],
      merged:['dirty-dozen','mach-iv','srp-iii','npi-16','npi-40','黑暗人格三联征'],
      note:'SD3（27 题）信度优于 Dirty Dozen（12 题），故保留 SD3，其余按同族重复处理。' },

    { title:'职业兴趣（Holland / RIASEC）',
      why:'Holland SDS、Strong Interest Inventory、O*NET Interest Profiler、各种"霍兰德职业兴趣测试"都是 RIASEC 六边形模型。SDS 与 Strong 为付费商业工具。',
      keep:['riasec-onet','onet-ip','holland-sds','strong-interest'],
      merged:['霍兰德职业兴趣测试','career-interest-inventory','职业兴趣量表简版'],
      note:'O*NET 版本由美国劳工部发布，属公共领域，题本与职业数据库完整开放，因此作为唯一保留的 RIASEC 实现。' },

    { title:'自尊量表',
      why:'Rosenberg SES、Coopersmith SEI、Janis-Field、Sorensen 自尊量表测的是同一构念；Coopersmith 需教师/家长版且受版权限制。',
      keep:['rosenberg'],
      merged:['coopersmith','janis-field','self-esteem-inventory','自尊量表简版'],
      note:'Rosenberg 量表 10 题、跨文化验证最充分，保留为唯一代表。' },

    { title:'压力知觉',
      why:'PSS-10、PSS-14、PSS-4 是同一量表的长度变体；中文版常被改名为"压力测试"。',
      keep:['pss-10'],
      merged:['pss-14','pss-4','知觉压力量表简版'],
      note:'10 题版本心理测量学表现最佳，其余长度版本合并。' },

    { title:'睡眠质量',
      why:'PSQI、ISI、Epworth 嗜睡量表、AIS 都涉及睡眠，但测的构念不同：PSQI 测一个月整体睡眠质量，ISI 测失眠严重度与日间影响，ESS 测日间嗜睡倾向。',
      keep:['isi','psqi'],
      merged:['ais','athens-insomnia','sleep-quality-scale'],
      note:'三者构念不同，故 ISI/PSQI/ESS 分列，不视为重复；仅合并同构念的 AIS 等。' },

    { title:'网络与手机成瘾',
      why:'Young IAT、CIAS、SAS-SV、MPATS、IGDS9-SF 测不同载体（网络/手机/游戏）但共用成瘾成分模型（突显、耐受、戒断、失控、功能损害）。',
      keep:['iat-young','sas-sv','igds9-sf','young-6'],
      merged:['cias','mpats','chen-internet-addiction','手机依赖量表简版'],
      note:'按载体拆分为三张表，避免"测网瘾"与"测手机瘾"结果互相矛盾。' },

    { title:'孤独感',
      why:'UCLA 孤独量表（20 题 / 8 题 / 3 题）、De Jong Gierveld 量表、社会连接量表测同一构念。',
      keep:['ucla-loneliness'],
      merged:['de-jong-gierveld','social-connectedness','ucla-8','ucla-3'],
      note:'UCLA-3 仅 3 题，信度不足以单独支撑结果解读，合并入 20 题版。' },

    { title:'情商（EQ）测验',
      why:'MSCEIT、EQ-i 2.0、TEIQue、SEIS、WLEIS 名称都叫"情商测试"，但方法学完全不同：MSCEIT 是能力测验（有标准答案），EQ-i/TEIQue 是自评特质测验，网上流行的"情商测试"多为自评。',
      keep:['eq-self','via-brief'],
      merged:['msceit','eq-i-2','seis','wleis','eq-self-report','teique-sf','情商测试流行版'],
      note:'能力型（MSCEIT）与自评型（EQ-i / TEIQue）不可互相替代，故各留一个代表：本站自建的《情商自评（四维框架）》属自评型，并外链 TEIQue 官方站。MSCEIT / EQ-i 2.0 因付费与资质限制仅作说明。' },

    { title:'英文外链 ↔ 站内中译版（语言可访问性）',
      why:'有一批量表只有英文站点提供在线施测。中文用户要么读英文，要么放弃。本站的处理原则是：**只要题本公开、可以忠实翻译，就另建一份中文版**（并把原站链接一并保留），而不是把用户直接丢给英文页面。' +
        '反过来，如果题目本身无法用文字忠实复刻（图形推理的 IQ 测验）、是商业自编题本、是测验合集、或是必须由受训人员施测的工具，就不硬做，改为明确说明原因并给出站内可用的中文替代。',
      keep:['eat-26','hsps','raads-r','cat-q','aq-10','asrs-v11'],
      merged:['英文原版在线施测页','无中文界面的外链量表'],
      note:'已建中文自建版的英文源站条目：EAT-26（进食态度）、HSPS（高敏感）、RAADS-R（孤独症成人筛查）、CAT-Q（社交掩饰）；' +
        '另有 PHQ-9 / GAD-7 / PHQ-15 / PCL-5 / ASRS / AUDIT / AQ-10 / UWES-9 等本来就在「外链 + 自建」双通道里。' +
        '这些页面上都有一条固定的「中译说明」，明确提示<b>中译版可能小部分破坏原意</b>。' +
        '其余英文源站条目（门萨图形推理、123test 智力测验、MindTools、各测验合集、C-SSRS）在页面里逐条说明了为什么不自建，并列出站内中文替代。' },

    { title:'孤独症 / ADHD 相关量表',
      why:'AQ-50、AQ-10、EQ、RAADS-R、CAT-Q、ASRS、WURS、CAARS 分属孤独症与 ADHD 两条线。同一量表常被拆成"儿童版/成人版/自评版"重复上线。',
      keep:['aq-10','asrs-v11','hsps','raads-r','cat-q'],
      merged:['aq-50','eq-empathy','wurs','caars','conners','assq'],
      note:'AQ-10 为 WHO/剑桥发布的短筛版，与 AQ-50 同源；已合并 AQ-50。ASRS 为 WHO 官方免费版。' },

    { title:'游戏化/娱乐测试的"标签复用"',
      why:'中文互联网上大量娱乐测试只是把同一套题目换皮（如"你是哪种动物"与"你的恋爱人格"用同一题本），或直接复制 16 型人格题目改标题。',
      keep:['fun-social-battery','fun-love-brain','fun-procrastination','fun-night-owl','fun-slack'],
      merged:['你是哪种动物','恋爱人格测试','性格颜色测试','趣味人格测验'],
      note:'本站对娱乐测试一律自建原创题本，不使用换皮题目；如同一构念只保留一个自建版本。' }
  ];

  /* ------------------------------------------------------------------ *
   * 4.5 英文源站条目的中文替代登记表
   *     这些条目外链的源站只有英文界面，但站内没有（或无法有）同量表的中文自建版。
   *     每条说明「为什么没有中文自建版」并给出站内可用的中文替代测试。
   *     alt 里的 id 必须真实存在（tools/verify.js 会校验）。
   * ------------------------------------------------------------------ */
  A.enOnlyNotes = {
    'openpsy-ipip-neo-120': {
      alt:['ipip-bigfive-50'],
      title:'源站是英文站，站内提供同结构的中文 50 题版',
      note:'Open Psychometrics 的 IPIP-NEO-120 是英文站。它的 120 题来自公共领域的 IPIP 题库，' +
        '我们已经用同一套题库做了一份<b>中文 50 题版（IPIP 大五人格量表）</b>，五个维度结构与 120 题版一致，' +
        '只是不做 30 个侧面的细分。需要侧面级分数再用英文原版。'
    },
    'similarminds-tests': {
      alt:['ipip-bigfive-50','enneagram-free','sd3','disc-lite'],
      title:'源站是英文站，站内有同构念的中文版',
      note:'SimilarMinds 是英文站，提供的是多个公开量表的英文改编版。' +
        '同构念的中文自建版本站都有，且计分与分档写得更明确，建议优先用站内版本。'
    },
    'humanmetrics-jti': {
      alt:['jung-16-type'],
      title:'源站是英文站，站内有中文四维类型测试',
      note:'HumanMetrics 的 Jung 类型学测试是英文站。站内的<b>《四维人格类型速测》</b>用同一套四维二分框架做了中文题本，' +
        '输出同样是四字母类型。'
    },
    'enneagram-eclectic': {
      alt:['enneagram-free'],
      title:'源站是英文站，站内有中文九型速测',
      note:'Eclectic Energies 是英文站。站内的<b>《九型人格速测（27 题）》</b>覆盖同样的九种核心动机类型，中文作答。'
    },
    'onet-ip': {
      alt:['riasec-onet'],
      title:'源站是英文站，站内有中文霍兰德兴趣测评',
      note:'美国劳工部的 O*NET 兴趣剖面是英文站（60 题）。站内的<b>《职业兴趣测评（霍兰德 RIASEC）》</b>是同一 RIASEC 六边形模型的' +
        '中文 30 题快速版。若你需要官方 60 题版与美国职业数据库的对应关系，再到英文源站做。'
    },
    'mindtools-career': {
      alt:['riasec-onet','career-anchors','grit-s','ips','brief-self-control'],
      title:'源站是英文站，站内有中文职场自评',
      note:'MindTools 是英文站，且其题目为商业自编、并非公开发表的心理量表，因此我们无法据"原量表"忠实复刻。' +
        '站内已自建的职场相关中文量表见下方。'
    },
    'greatergood-empathy': {
      alt:['iri','ecr-r','ucla-loneliness','spin','assertiveness'],
      title:'源站是英文站，站内有中文的关系与共情量表',
      note:'UC Berkeley 至善科学中心的测验是英文站，且是一个测验合集而非单个量表，无法整体翻译。' +
        '站内已自建同构念的中文量表见下方。'
    },
    'greatergood-parenting': {
      alt:['parenting-styles','sdq','pbi'],
      title:'源站是英文站，站内有中文的亲子与教养量表',
      note:'这是伯克利至善科学中心的英语测验合集，不是单个量表。站内已自建的中文亲子量表见下方。'
    },
    'via-official': {
      alt:['via-brief','swls','perma-15','flourishing'],
      title:'源站有中文界面，但完整版需要注册',
      note:'VIA 官方站（viacharacter.org）提供中文界面，因此不需要我们另建中文题本——但完整版需要注册账号，' +
        '本站的<b>《性格优势速测》</b>是中文免注册的快速版，可以先用它定位。需要 24 项优势的完整排序请去官方站注册。'
    },
    'authentic-happiness': {
      alt:['swls','panas','gq-6','mlq','via-brief','perma-15','lot-r'],
      title:'源站是英文站，站内已自建其中多个量表的中文版',
      note:'宾夕法尼亚大学的 Authentic Happiness 量表库是英文站，且是一个合集。' +
        '其中使用最广的几个量表，本站已经做过中文自建版（见下方）；两个版本可以互相验证。'
    },
    'politicalcompass-org': {
      alt:['political-compass-lite'],
      title:'源站是英文站，站内有中文两轴政治光谱自评',
      note:'The Political Compass 是英文站（62 题）。站内的<b>《政治光谱自评（2 轴 20 题）》</b>用同一套' +
        '"经济左右 × 社会自由-权威"框架做了中文题本，但<b>题本是我们自编的，与原站题目不同</b>，两者结果不宜直接对照。'
    },
    'yourmorals': {
      alt:['mfq-30','political-compass-lite'],
      title:'源站是英文站，站内有中文道德基础问卷',
      note:'YourMorals.org 是英文研究平台，需注册。站内的<b>《道德基础问卷（MFQ-30）》</b>就是该平台核心量表的中文题本，' +
        '同样测关爱、公平、忠诚、权威、圣洁五条道德基础。'
    },
    'eight-values': {
      alt:['political-compass-lite'],
      title:'源站是英文站，站内有中文政治立场自评',
      note:'8values / 9axes 是英文的开源项目。站内的<b>《政治光谱自评（2 轴 20 题）》</b>是中文版，' +
        '但它只有两轴，比 8values 的八个轴更粗略。'
    },
    'openpsy-tests': {
      alt:['ipip-bigfive-50','sd3','ecr-r','political-compass-lite'],
      title:'源站是英文站，站内有同构念的中文版',
      note:'Open Psychometrics 是一个英文测验合集与公开数据集站点，不是单个量表，无法整体翻译。' +
        '它最常用的几个量表本站都有中文自建版（见下方）。这个站真正的独特价值在于<b>可下载的原始数据</b>，那部分不需要中文。'
    },
    '123test-iq': {
      alt:['crt-7','ncs-18'],
      title:'源站是英文站，且智力测验无法用纯文本忠实自建',
      note:'123test 是英文站，其智力测验包含<b>言语与数字推理题</b>，题目本身高度依赖语言与文化背景，' +
        '直接翻译会严重失真。纯文本静态站点也无法复刻图形推理题的标准化材料。' +
        '因此本站不自建"中文 IQ 测验"，只提供不依赖语言文化的中文替代（见下方），以及门萨官方的图形推理测验外链。'
    },
    'mensa-no': {
      alt:['crt-7'],
      title:'图形推理测验无法用纯文本自建，源站为英文界面',
      note:'挪威门萨这套 35 题测验的主体是<b>图形推理矩阵</b>——需要成套的标准化图片，纯文本静态站点无法忠实复刻，' +
        '硬做出来就是假题。好在它几乎不依赖语言，英文界面不影响作答。若你打不开或想要中文的纯文字题，可试站内的认知反思测验。'
    },
    'mensa-dk': {
      alt:['crt-7'],
      title:'图形推理测验无法用纯文本自建，源站为丹麦/英文界面',
      note:'与挪威门萨版同理：题目是图形推理矩阵，需要标准化图片材料，无法用文字自建。' +
        '站点本身对语言的依赖很低，界面为丹麦语/英语，不影响作答。'
    },
    'cssrs-link': {
      alt:['phq-9','gad-7'],
      title:'英文源站，但这是施测者工具，不适合做成自助网页',
      note:'C-SSRS 官网是英文界面，但官方提供<b>简体中文版量表与培训材料</b>可免费下载，语言不是障碍。' +
        '真正的原因是：C-SSRS 是<b>由受训人员施测与判读的风险评估工具</b>，把它做成一个自动出分的自助网页既不合适也不安全。' +
        '如果你此刻有伤害自己的念头，请直接拨打 <b>12356</b>；想了解自己的情绪状态，可先用站内的中文筛查量表。'
    }
  };

  /* ------------------------------------------------------------------ *
   * 5. 全局常量
   * ------------------------------------------------------------------ */
  A.LIKERT4 = ['完全不会','有几天','一半以上的天数','几乎每天'];
  A.LIKERT5 = ['完全不符合','比较不符合','一般','比较符合','完全符合'];
  A.INTRO_WINDOW_2W = '请根据<strong>过去两周</strong>的实际情况作答，不要刻意选择"看起来更好"的选项。';
})(window.ATT);
