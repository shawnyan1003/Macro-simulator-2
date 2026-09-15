'use strict';
/* ============================================================
 *  Bilingual UI — English (default) ⇄ 中文
 *  English is the source language; when 中文 is selected the text
 *  already rendered on screen is translated in place, so switching
 *  never needs a page reload.
 * ============================================================ */
(function () {
  const STORE_KEY = 'mps_lang';

  /* ------------------------- dictionary (en → zh) ------------------------- */
  const DICT = {
    /* shell / login */
    'Macroeconomic Policy Simulator': '宏观经济政策模拟器',
    'Macroeconomic Policy Simulator · IBDP Economics': '宏观经济政策模拟器 · IBDP 经济学',
    'IBDP Economics HL · Three-nation macro policy battle · A full year in government': 'IBDP 经济学 HL · 三国宏观政策博弈 · 执政一整年',
    'Join as Student': '以学生身份加入',
    'Teacher Login': '教师登录',
    'Teacher Super Account': '教师超级账号',
    "Teachers can view every country's accounts and passwords, advance quarters, publish external shocks and adjust indicator weights.": '教师可查看所有国家的账号与密码、推进季度、发布外部冲击并调整指标权重。',
    'Username': '用户名',
    'Password': '密码',
    'Log In': '登录',
    'Log out': '退出登录',
    'All data is stored on the server — refreshing the page never loses progress · double-click any economics term to see its definition': '全部数据保存在服务器，刷新不会丢失进度 · 双击任一经济学术语可查看解释',
    'Not founded yet · first chair names it': '尚未建国 · 首任主席可命名',
    'no password set': '尚未设置密码',
    'joined · country password required': '人已加入 · 需要国家密码',
    'Create the chair account of': '创建主席账号：',
    'Found the country & enter': '建国并进入',
    'Join this country': '加入该国',
    'Members:': '成员：',
    'Country name (1–16 characters)': '国家名称（1–16 字）',
    'Country password (set by your teacher)': '国家密码（由老师设置）',
    'Country password (ask your teacher)': '国家密码（向老师索取）',
    'Your username': '你的用户名',
    'Your password': '你的密码',
    'My role': '我的角色',
    'My username': '我的用户名',
    'My password': '我的密码',
    'You are the first member of this country, so you automatically become its <b>chair</b> and can <b>name the country (once per game)</b>. Your teammates join with the same <b>country password</b>, which your <b>teacher</b> sets and gives to the whole group.': '你是该国第一位成员，因此自动成为<b>主席</b>，并可<b>为国家命名（每局一次）</b>。你的队友需使用同一个<b>国家密码</b>加入，该密码由<b>老师</b>设置并发给全组。',

    /* tabs / header */
    'Overview': '总览',
    'Data': '数据',
    'Policy Toolkit': '政策工具箱',
    'Trade & FX': '贸易与汇率',
    'Country Feed': '国家动态',
    'My Team': '我的团队',
    'Teacher Panel': '教师面板',
    'Teacher console · ': '教师控制台 · ',
    ' · viewing ': ' · 正在查看 ',
    ' · Chair': ' · 主席',
    'Chair': '主席',
    'Teacher': '教师',
    'member': '名成员',
    'members': '名成员',
    'member(s) joined': '名成员已加入',
    'Setup phase': '准备阶段',
    'Setup · waiting for the teacher': '准备阶段 · 等待老师',
    'Governing': '执政中',
    'Composite Economic Health Index': '综合经济健康指数',

    /* glossary */
    'Glossary': '术语表',
    'Economics glossary': '经济学术语表',
    'Search for a term…': '搜索术语…',
    'No matching terms': '没有匹配的术语',
    'Click anywhere to close': '点击任意处关闭',
    'Term': '术语',

    /* roles */
    'Government': '政府',
    'Labour': '劳工',
    'Firms': '企业',
    'Set fiscal / monetary / supply-side / trade policy': '制定财政 / 货币 / 供给侧 / 贸易政策',
    'Represent workers: table wage and employment motions': '代表劳动者：提出工资与就业动议',
    'Represent firms: table investment and business motions': '代表企业：提出投资与经营动议',

    /* overview */
    'Global environment: inflation': '全球环境：通胀率',
    'world growth': '世界增长',
    'quarter(s) elapsed': '个季度已过去',
    'Current index': '当前指数',
    'Start': '起始',
    'change': '变化',
    'Current rank': '当前排名',
    'countries · the winner is decided by the gain in the index': '个国家 · 胜负由指数提升幅度决定',
    'Output gap': '产出缺口',
    'Overheating': '经济过热',
    'Weak demand': '需求疲软',
    'Near potential output': '接近潜在产出',
    'Your role': '你的角色',
    'Can submit policies': '可直接提交政策',
    'Can submit proposals': '可提交提案',
    'Core macroeconomic indicators': '核心宏观经济指标',
    'Real GDP': '实际 GDP',
    'PPP per capita': '购买力平价人均',
    'int$': '国际元',
    'Real growth': '实际增长',
    'Potential growth': '潜在增长',
    'Inflation': '通胀率',
    'Target': '目标',
    'expected': '预期',
    'Unemployment': '失业率',
    'NAIRU': 'NAIRU',
    'Budget balance': '财政余额',
    'of GDP': '占 GDP',
    'Exports': '出口',
    'imports': '进口',
    'Gini coefficient': '基尼系数',
    'Life expectancy': '预期寿命',
    'years': '年',
    'Policy stance and structure': '政策立场与经济结构',
    'Fiscal stance': '财政立场',
    'Monetary stance': '货币立场',
    'Net export impulse': '净出口拉动',
    'Expansionary': '扩张性',
    'Contractionary': '紧缩性',
    'Confidence: business': '信心：企业',
    'consumer': '消费者',
    'sovereign risk': '主权风险',
    'pp': '个百分点',
    'Expenditure structure: C': '支出结构：C',
    'Supply side: human capital': '供给侧：人力资本',
    'technology': '技术',
    'infrastructure': '基础设施',
    'competition': '竞争',
    'Economic trends': '经济走势',
    'No historical data yet': '暂无历史数据',
    'Income per head': '人均收入',
    'Growth': '增长',
    'Employment': '就业',
    'Price stability': '物价稳定',
    'Debt sustainability': '债务可持续性',
    'Human development': '人类发展',
    'Happy planet': '幸福星球',
    'Income distribution': '收入分配',
    'Multidimensional poverty': '多维贫困',
    'Current account': '经常账户',
    'Human capital': '人力资本',
    'Technology': '技术水平',
    'Infrastructure': '基础设施',
    'Market competition': '市场竞争',
    'Exchange rate index': '汇率指数',
    'Composite index': '综合指数',
    'Potential output': '潜在产出',
    'Human development (HDI)': '人类发展（HDI）',
    'Happy planet (HPI)': '幸福星球（HPI）',

    /* data view */
    'Observing': '正在观察',
    "Other countries’ policy details (tax rates, interest rates, spending composition) are hidden — you can only see macro outcomes and trade policy.": '其他国家的政策细节（税率、利率、支出结构）是隐藏的——你只能看到宏观结果与贸易政策。',
    'Indicator panel': '指标面板',
    'Historical trends': '历史走势',
    'Reference values (real-world calibration)': '参考值（现实校准）',
    'These reference values are real-world figures used to calibrate the model. The starting positions in the model have been adjusted into comparable teaching versions, so the magnitudes differ from the reference data.': '这些参考值为校准模型所用的现实数据。模型中各国的初始位置已调整为可用于教学的可比版本，因此数值与参考数据不同。',
    'gdp': 'GDP',
    'growth': '增长',
    'inflation': '通胀',
    'unemployment': '失业率',
    'debt': '债务',
    'gini': '基尼系数',
    'hdi': 'HDI',
    'fx': '汇率',
    'policy rate': '政策利率',
    'Population (millions)': '人口（百万）',
    'GDP per capita (US$)': '人均 GDP（美元）',
    'GDP per capita (PPP int$)': '人均 GDP（购买力平价国际元）',
    'Real GDP (bn domestic currency)': '实际 GDP（本币十亿）',
    'Price level (base = 100)': '价格水平（基期 = 100）',
    'Expected inflation %': '预期通胀率 %',
    'Central bank target %': '央行目标 %',
    'Government revenue/GDP %': '财政收入/GDP %',
    'Government spending/GDP %': '财政支出/GDP %',
    'Transfers/GDP %': '转移支付/GDP %',
    'Debt interest/GDP %': '债务利息/GDP %',
    'Tariff revenue/GDP %': '关税收入/GDP %',
    'Government debt/GDP %': '政府债务/GDP %',
    'Long-term rate %': '长期利率 %',
    'Corporate borrowing cost %': '企业融资成本 %',
    'Real borrowing cost %': '实际融资成本 %',
    'Neutral real rate %': '中性实际利率 %',
    'Monetary conditions index': '货币条件指数',
    'Net exports (US$100m)': '净出口（亿美元）',
    'Trade openness %': '贸易开放度 %',
    'Exchange rate (domestic/USD)': '汇率（本币/美元）',
    'Exchange rate regime': '汇率制度',
    'FX reserves (US$100m)': '外汇储备（亿美元）',
    'Wellbeing (0–10)': '幸福感（0–10）',
    'Life expectancy (years)': '预期寿命（年）',
    'Ecological footprint': '生态足迹',
    'Environmental quality (0–100)': '环境质量（0–100）',
    'Human capital (0–100)': '人力资本（0–100）',
    'Health care (0–100)': '医疗卫生（0–100）',
    'Infrastructure (0–100)': '基础设施（0–100）',
    'Technology (0–100)': '技术水平（0–100）',
    'Market competition (0–100)': '市场竞争（0–100）',
    'Regulatory burden (0–100)': '监管负担（0–100）',
    'Trade openness (0–100)': '贸易开放（0–100）',
    'Business confidence': '企业信心',
    'Consumer confidence': '消费者信心',
    'Credit health (0–100)': '信贷健康（0–100）',
    'Fixed': '固定汇率',
    'Managed float': '管理浮动',
    'Free float': '自由浮动',
    '(US$100m)': '（亿美元）',

    /* policy toolkit */
    'Loading data…': '正在加载数据…',
    'Only members of the <b>government team</b> can adjust policy directly. As a member of the': '只有<b>政府组</b>成员可以直接调整政策。作为',
    'team you can describe what you want in plain language below; the system translates it into policy parameters for the government to consider (you can also table a motion under “My Team”).': '组成员，你可以在下方用通俗语言描述诉求；系统会把它转换为政策参数供政府参考（也可以在“我的团队”中提出动议）。',
    'When you are done, click <b>Submit this round’s policy</b>. Policies take effect when the teacher advances the next quarter, and there are <b>transmission lags</b>.': '完成后点击<b>提交本轮政策</b>。政策将在老师推进下一季度时生效，并且存在<b>传导时滞</b>。',
    'Fiscal policy': '财政政策',
    'Monetary policy': '货币政策',
    'Interventionist supply-side': '干预型供给侧政策',
    'Market-oriented supply-side': '市场导向供给侧政策',
    'Redistribution & equity': '再分配与公平',
    'Trade & exchange rate': '贸易与汇率',
    'Free-text policy': '自然语言政策',
    'Education spending': '教育支出',
    'Health care spending': '医疗支出',
    'Infrastructure spending': '基础设施支出',
    'Defence spending': '国防支出',
    'Other spending': '其他支出',
    'Transfer payments': '转移支付',
    'Universal basic income (UBI)': '全民基本收入（UBI）',
    'Personal income tax': '个人所得税',
    'Corporate income tax': '企业所得税',
    'Capital tax': '资本税',
    'Consumption tax / VAT': '消费税 / 增值税',
    'Tax progressivity': '税收累进性',
    'Policy / base interest rate': '政策 / 基准利率',
    'Required reserve ratio (RRR)': '法定存款准备金率（RRR）',
    'Open market operations (+ = inject liquidity)': '公开市场操作（+ = 投放流动性）',
    'Quantitative easing size': '量化宽松规模',
    'Education & training programmes': '教育与培训计划',
    'R&D programmes': '研发计划',
    'Infrastructure programmes': '基础设施计划',
    'Support for small & medium firms': '对中小企业的支持',
    'Infant industry protection': '幼稚产业保护',
    'Support for exporters': '对出口企业的支持',
    'Marketised education (vouchers)': '教育市场化（学券制）',
    'Privatisation': '私有化',
    'Deregulation': '放松管制',
    'Private finance (PPP)': '私人融资（PPP）',
    'Outsourcing': '外包',
    'Antitrust / competition policy': '反垄断 / 竞争政策',
    'Trade liberalisation': '贸易自由化',
    'Trade union power': '工会力量',
    'Minimum wage': '最低工资',
    'Unemployment benefit level': '失业救济水平',
    'Job security legislation': '就业保障立法',
    'Green / environmental policy': '绿色 / 环境政策',
    'Direct provision (free public services)': '直接提供（免费公共服务）',
    'Subsidies on necessities': '生活必需品补贴',
    'Price control intensity': '价格管制强度',
    'Anti-discrimination legislation': '反歧视立法',
    '%GDP': '占 GDP %',
    'Submit this round’s policy': '提交本轮政策',
    'Discard changes': '放弃修改',
    'Unsaved changes': '有未保存的修改',
    'Exchange rate regime & capital flows': '汇率制度与资本流动',
    'Exchange rate target (↑ = depreciation)': '汇率目标（↑ = 贬值）',
    'index': '指数',
    'FX intervention intensity': '外汇干预强度',
    'Capital controls': '资本管制',
    'Current exchange rate index': '当前汇率指数',
    'FX reserves': '外汇储备',
    'Trade protection instruments (by partner)': '贸易保护工具（按伙伴国）',
    'Partner': '伙伴国',
    'Tariff %': '关税 %',
    'Export subsidy %': '出口补贴 %',
    'Quota %': '配额 %',
    'Non-tariff barriers': '非关税壁垒',
    'Free trade agreement': '自由贸易协定',
    'Rival countries can see your trade policy and may retaliate.': '对手国可以看到你的贸易政策，并可能采取报复。',
    'Describe your policy in one sentence': '用一句话描述你的政策',
    'For example:': '例如：',
    'To curb inflation, raise the policy rate by 0.5 percentage points': '为抑制通胀，将政策利率上调 0.5 个百分点',
    'Impose a 20% tariff on country A while subsidising exporters': '对 A 国加征 20% 关税，同时补贴出口企业',
    'Introduce a universal basic income and cut corporation tax by 3 points': '引入全民基本收入，并将企业所得税下调 3 个百分点',
    'The system turns your sentence into concrete parameters for you to': '系统会把你的句子转换为具体参数，供你',
    ' before submitting.': ' 后再提交。',
    'Describe your programme in plain language…': '用通俗语言描述你的施政方案…',
    'Interpret as policy parameters': '解读为政策参数',
    'Interpretation': '解读结果',
    'Policy instrument': '政策工具',
    'Change': '变化',
    'Resulting value': '结果值',
    'Confirm & submit': '确认并提交',
    'Submitted — see the record under “Country Feed”.': '已提交——可在“国家动态”中查看记录。',
    'Could not interpret that': '无法解读这句话',
    'Submission failed': '提交失败',
    ' policy change(s)': ' 项政策调整',
    'No policy change': '没有政策变化',
    'Changes discarded': '已放弃修改',
    'Country A': 'A 国',
    'Country B': 'B 国',
    'Country C': 'C 国',
    'Rest of the world': '世界其他国家',

    /* trade & FX view */
    'ranking by gain (this decides the winner)': '按提升幅度排名（决定胜负）',
    'Index gain': '指数提升',
    'Key indicators across the three countries': '三国关键指标对比',
    'Indicator': '指标',
    'Classified': '保密',
    'Your country is highlighted in green. The policy rate is domestic policy: only your own country and the teacher can see it.': '你的国家以绿色高亮。政策利率属于国内政策：只有本国和教师可以看到。',
    'Bilateral trade links (export destinations, US$100m)': '双边贸易联系（出口去向，亿美元）',
    ' exports': '的出口',
    'Tariffs imposed by one country directly depress another’s exports, feeding through to that country’s aggregate demand, employment and growth.': '一国加征关税会直接压低另一国的出口，并传导到该国的总需求、就业与增长。',
    'Tariff policies (public information)': '关税政策（公开信息）',
    'Imposing country / Target': '征收国 / 对象国',
    'Quotas, non-tariff barriers, export subsidies and free trade agreements also shift trade flows.': '配额、非关税壁垒、出口补贴和自由贸易协定同样会改变贸易流向。',
    'Victory depends on how far the index has risen since the start, not on its absolute level — countries that begin further behind can improve the most.': '胜负取决于指数自开局以来的提升幅度，而非绝对水平——起点较低的国家反而可能进步最多。',
    'Composite index trend': '综合指数走势',
    'Real growth %': '实际增长 %',
    'Output gap %': '产出缺口 %',
    'Inflation %': '通胀率 %',
    'Unemployment %': '失业率 %',
    'Debt/GDP %': '债务/GDP %',
    'Budget balance %': '财政余额 %',
    'Current account %': '经常账户 %',
    'MPI %': 'MPI %',
    'Policy rate %': '政策利率 %',

    /* feed */
    'World events': '世界大事',
    'Team proposals': '小组提案',
    'No entries yet': '暂无记录',
    'No events yet': '暂无事件',
    'No proposals yet': '暂无提案',

    /* my team */
    'Cabinet of': '内阁成员：',
    'Role': '角色',
    'Status': '状态',
    '(you)': '（你）',
    'Country password:': '国家密码：',
    '(visible to the chair only — ask your chair for it)': '（仅主席可见——请向主席索取）',
    'Rename the country (once per game)': '重命名国家（每局一次）',
    'Reset the country password': '重置国家密码',
    'Submit a policy proposal': '提交政策提案',
    'Labour and firms teams can put demands to the government here; government members can also record their programme.': '劳工与企业组可在此向政府提出诉求；政府成员也可记录自己的施政纲领。',
    'e.g. we want higher unemployment benefits and stronger support for small firms…': '例如：我们希望提高失业救济，并加大对小企业的支持…',
    'Submit proposal': '提交提案',
    'Existing proposals': '已有提案',
    'Proposal submitted': '提案已提交',

    /* teacher panel */
    'Advance time': '推进时间',
    'Now:': '当前：',
    'quarter': '季度',
    'All countries’ policies take effect once time advances.': '所有国家的政策将在推进时间后统一生效。',
    'Advance 1 quarter': '推进 1 个季度',
    'Advance 1 year (4 quarters)': '推进 1 年（4 个季度）',
    'Refresh data': '刷新数据',
    'Publish an external shock': '发布外部冲击',
    'Global': '全球',
    'Composite index weights (auto-normalised)': '综合指数权重（自动归一化）',
    'Save weights': '保存权重',
    'Country login passwords': '各国登录密码',
    'Every student needs the country login password in order to join that country. Set one password per country here and give it to the group; you can change it at any time (members who have already joined stay logged in).': '每个学生都需要该国的登录密码才能加入。请在此为每个国家设置一个密码并发给对应小组，可随时修改（已加入的成员保持登录状态）。',
    'Login password': '登录密码',
    'All accounts and passwords': '所有账号与密码',
    ' · country password ': ' · 国家密码 ',
    'Action': '操作',
    'Remove': '移除',
    'Teacher account:': '教师账号：',
    'New teacher password': '新教师密码',
    'Reset the world': '重置世界',
    'Resetting clears all economic data and returns the world to the starting position (registered accounts and country names are kept by default).': '重置将清空所有经济数据并回到初始状态（默认保留已注册账号与国家名称）。',
    'Reset but keep accounts': '重置但保留账号',
    'Full reset (delete all accounts)': '完全重置（删除所有账号）',
    'No permission': '无权限',
    'Reset the world? All economic data will return to the starting position.': '确定要重置世界吗？所有经济数据将回到初始状态。',

    /* toasts and server messages */
    'Logged in — welcome to government!': '登录成功——欢迎执政！',
    'Network error: ': '网络错误：',
    'Something went wrong': '出了点问题',
    'Failed': '失败',
    'Time advanced': '时间已推进',
    'Shock published': '冲击已发布',
    'Weights saved': '权重已保存',
    'Country password saved': '国家密码已保存',
    'Removed': '已移除',
    'World reset': '世界已重置',
    'Teacher password updated': '教师密码已更新',
    'Saved': '已保存',
    'Please enter a country password': '请输入国家密码',
    'New quarter: ': '新季度：',
    'Please enter a username and password': '请输入用户名和密码',
    'Incorrect username or password': '用户名或密码错误',
    'Country does not exist': '国家不存在',
    'This country already has a chair — join it instead': '该国已有主席——请直接加入',
    'Please complete the username and password': '请填写用户名和密码',
    'The country name must be 1–16 characters': '国家名称需为 1–16 个字符',
    'Please enter the country password your teacher gave you': '请输入老师给你的国家密码',
    'Your teacher has not set a login password for this country yet — please ask your teacher for it': '老师尚未为该国设置登录密码——请向老师索取',
    'Incorrect country password': '国家密码错误',
    'That username is already taken': '该用户名已被占用',
    'No chair account exists for this country yet — a government member must create one first': '该国还没有主席账号——请先由政府成员创建',
    'Please choose a valid role': '请选择有效的角色',
    'Please log in first': '请先登录',
    'Only the government team can change policy (other roles may table motions)': '只有政府组可以修改政策（其他角色可提出动议）',
    'Please log in as a student to table a motion': '请以学生身份登录后再提出动议',
    'Please enter the text of the motion': '请输入动议内容',
    'Only the teacher can set country passwords': '只有教师可以设置国家密码',
    ' already has ': ' 已有 ',
    'member(s); the maximum is': '名成员；上限为',
    'Only the teacher can advance a quarter': '只有教师可以推进季度',
    'Only the teacher can publish an external shock': '只有教师可以发布外部冲击',
    'Only the teacher can adjust the weights': '只有教师可以调整权重',
    'Only the teacher can reset the world': '只有教师可以重置世界',

    /* server-generated feed entries */
    'was elected the first chair and the country was named': '当选首任主席，国家被命名为',
    'joined the': '加入了',
    ' team': '小队',
    'Save': '保存',
    'Country feed': '国家动态',
    'Government debt/GDP': '政府债务/GDP',
    'Current account/GDP': '经常账户/GDP',
    'Fixed (pegged)': '固定汇率（盯住）',
    'Policy change:': '政策调整：',
    'tabled a motion:': '提出动议：',
    'The country was renamed from': '国家由',
    '” to “': '” 更名为 “',
    'Country password updated': '国家密码已更新',
    'Time advanced to': '时间推进到',
    'External shock:': '外部冲击：',
    'The teacher set a new login password for': '老师为以下国家设置了新的登录密码：',
    'The teacher cleared the login password of': '老师清空了以下国家的登录密码：',
    '(nobody can join until a new one is set)': '（设置新密码前无人可加入）',
    'FX reserves exhausted: the currency was forced to depreciate and a currency crisis broke out!': '外汇储备耗尽：货币被迫贬值，爆发货币危机！'
  };

  /* ------------------------- engine ------------------------- */
  let lang = localStorage.getItem(STORE_KEY) === 'zh' ? 'zh' : 'en';

  const isWordStart = (s) => /^[A-Za-z0-9]/.test(s);
  const isWordEnd = (s) => /[A-Za-z0-9]$/.test(s);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* longest key first, so whole sentences win over single words */
  const KEYS = Object.keys(DICT).filter((k) => k && k.length > 1)
    .sort((a, b) => b.length - a.length);
  const RE = new RegExp(KEYS.map((k) =>
    (isWordStart(k) ? '\\b' : '') + escRe(k) + (isWordEnd(k) ? '\\b' : '')).join('|'), 'g');

  function t(s) {
    if (lang !== 'zh' || s === null || s === undefined) return s;
    return String(s).replace(RE, (m) => (DICT[m] !== undefined ? DICT[m] : m));
  }

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'SVG', 'svg', 'NOSCRIPT']);
  const ATTRS = ['placeholder', 'title', 'aria-label'];

  function applyText(node) {
    const src = node._i18nSrc !== undefined ? node._i18nSrc : node.nodeValue;
    if (node._i18nSrc === undefined) node._i18nSrc = src;   // keep the English source
    const out = lang === 'zh' ? t(src) : src;
    if (out !== node.nodeValue) node.nodeValue = out;
  }
  function applyAttrs(el) {
    ATTRS.forEach((a) => {
      if (!el.hasAttribute(a)) return;
      const bak = '_i18n_' + a;
      if (el[bak] === undefined) el[bak] = el.getAttribute(a);
      el.setAttribute(a, lang === 'zh' ? t(el[bak]) : el[bak]);
    });
  }
  function apply(root) {
    if (!root) return;
    if (root.nodeType === 3) { applyText(root); return; }
    if (root.nodeType === 1) applyAttrs(root);
    if (!document.createTreeWalker) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
          applyAttrs(node);
          return NodeFilter.FILTER_SKIP;
        }
        const p = node.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const list = [];
    while (walker.nextNode()) if (walker.currentNode.nodeType === 3) list.push(walker.currentNode);
    list.forEach(applyText);
  }

  function updateButtons() {
    const label = lang === 'zh' ? '🌐 English' : '🌐 中文';
    const title = lang === 'zh' ? 'Switch to English' : '切换为中文';
    $$('.lang-btn').forEach((b) => { b.textContent = label; b.title = title; });
  }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function set(next) {
    lang = next === 'zh' ? 'zh' : 'en';
    localStorage.setItem(STORE_KEY, lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    if (typeof window.refreshI18n === 'function') window.refreshI18n();
    updateButtons();
  }
  function toggle() { set(lang === 'zh' ? 'en' : 'zh'); }

  window.I18N = { t, apply, set, toggle, updateButtons, get lang() { return lang; } };

  if (document.readyState !== 'loading') { apply(document); updateButtons(); }
  document.addEventListener('DOMContentLoaded', () => { apply(document); updateButtons(); });
})();
