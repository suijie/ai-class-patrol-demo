(function () {
  const DEMO_NOW = '2026-08-18T11:30:00+08:00';
  const DEMO_VERSION = 'V0.54';
  const anomalyTypes = [
    { id: 'teacher_absent', category: 'teacher', label: '教师考勤', ruleLabel: '迟到、早退分别判定', defaultSeverity: 'important', criteria: [
      { id: 'late_minutes', label: '迟到', operatorLabel: '超过', defaultValue: 5, unit: '分钟', min: 1, max: 30, help: '超过课表上课时间仍未到岗' },
      { id: 'early_leave_minutes', label: '早退', operatorLabel: '提前', defaultValue: 5, unit: '分钟', min: 1, max: 30, help: '早于课表下课时间离开教学区域' }
    ] },
    { id: 'teacher_phone', category: 'teacher', label: '教师异常行为', ruleLabel: '使用手机、打电话、抽烟分别计次', defaultSeverity: 'serious', criteria: [
      { id: 'phone_count', label: '使用手机', operatorLabel: '达到', defaultValue: 2, unit: '次', min: 1, max: 20, help: '课堂内识别到使用手机行为' },
      { id: 'call_count', label: '打电话', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 20, help: '课堂内识别到接打电话行为' },
      { id: 'smoking_count', label: '抽烟', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 20, help: '课堂内识别到疑似抽烟行为' }
    ] },
    { id: 'teacher_misconduct', category: 'teacher', label: '体罚辱生', ruleLabel: '体罚、语言暴力分别计次', defaultSeverity: 'serious', criteria: [
      { id: 'corporal_count', label: '体罚', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 10, help: '识别到疑似体罚行为' },
      { id: 'verbal_count', label: '语言暴力', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 10, help: '识别到疑似侮辱或威胁性语言' }
    ] },
    { id: 'teacher_schedule', category: 'teacher', scene: 'break', label: '课间行为情况', ruleLabel: '提前到位、拖堂分别判定', defaultSeverity: 'important', criteria: [
      { id: 'arrival_lead_minutes', label: '提前到位', operatorLabel: '少于', defaultValue: 5, unit: '分钟', min: 1, max: 30, help: '距离上课开始的提前到位时间不足' },
      { id: 'overrun_minutes', label: '拖堂', operatorLabel: '超过', defaultValue: 5, unit: '分钟', min: 1, max: 30, help: '超过课表下课时间仍持续授课' }
    ] },
    { id: 'teacher_attire', category: 'teacher', label: '教师着装', ruleLabel: '3 分裤、5 分裤分别计次', defaultSeverity: 'normal', criteria: [
      { id: 'three_quarter_count', label: '3 分裤', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 10, help: '识别到对应着装后计次' },
      { id: 'five_quarter_count', label: '5 分裤', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 10, help: '识别到对应着装后计次' }
    ] },
    { id: 'teacher_sitting', category: 'teacher', label: '教师就坐', ruleLabel: '就坐、站立时长分别判定', defaultSeverity: 'normal', criteria: [
      { id: 'seated_minutes', label: '累计就坐', operatorLabel: '超过', defaultValue: 20, unit: '分钟', min: 1, max: 60, help: '课堂内累计处于就坐状态' },
      { id: 'standing_minutes', label: '累计站立', operatorLabel: '少于', defaultValue: 15, unit: '分钟', min: 1, max: 60, help: '课堂内累计处于站立状态' }
    ] },
    { id: 'teacher_mandarin', category: 'teacher', label: '不使用普通话教学', ruleLabel: '占比、持续时长共同判定', defaultSeverity: 'normal', criteria: [
      { id: 'non_mandarin_ratio', label: '非普通话占比', operatorLabel: '超过', defaultValue: 20, unit: '%', min: 1, max: 100, help: '课堂有效语音中非普通话内容占比' },
      { id: 'continuous_minutes', label: '连续非普通话', operatorLabel: '超过', defaultValue: 3, unit: '分钟', min: 1, max: 30, help: '单次连续使用非普通话的时长' }
    ] },
    { id: 'student_discipline', category: 'student_class', label: '纪律情况', ruleLabel: '交头接耳、随意走动分别判定', defaultSeverity: 'normal', criteria: [
      { id: 'whisper_count', label: '交头接耳', operatorLabel: '达到', defaultValue: 3, unit: '次', min: 1, max: 30, help: '课堂内识别到交头接耳行为' },
      { id: 'leave_seat_seconds', label: '随意走动', operatorLabel: '持续超过', defaultValue: 30, unit: '秒', min: 5, max: 600, step: 5, help: '未获允许离开座位并持续走动' }
    ] },
    { id: 'class_count', category: 'student_class', label: '课堂人数异常', ruleLabel: '人数偏差、迟到、早退分别判定', defaultSeverity: 'important', criteria: [
      { id: 'deviation_percent', label: '人数偏差', operatorLabel: '超过', defaultValue: 20, unit: '%', min: 1, max: 100, help: '实到人数与课表应到人数的偏差' },
      { id: 'late_students', label: '学生迟到', operatorLabel: '达到', defaultValue: 3, unit: '人', min: 1, max: 50, help: '超过上课时间进入教室的学生人数' },
      { id: 'early_leave_students', label: '学生早退', operatorLabel: '达到', defaultValue: 3, unit: '人', min: 1, max: 50, help: '早于下课时间离开教室的学生人数' }
    ] },
    { id: 'student_participation', category: 'student_class', label: '学生参与度低', ruleLabel: '分值、持续时长共同判定', defaultSeverity: 'normal', criteria: [
      { id: 'score', label: '参与度得分', operatorLabel: '低于', defaultValue: 60, unit: '分', min: 1, max: 100, help: '综合举手、发言、起立和书写等事件计算' },
      { id: 'low_minutes', label: '低参与状态', operatorLabel: '持续超过', defaultValue: 10, unit: '分钟', min: 1, max: 60, help: '参与度持续低于设定分值' }
    ] },
    { id: 'student_phone', category: 'student_class', label: '学生疑似使用手机', ruleLabel: '次数、持续时长共同判定', defaultSeverity: 'important', criteria: [
      { id: 'phone_count', label: '使用手机', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 20, help: '课堂内识别到疑似使用手机行为' },
      { id: 'continuous_seconds', label: '单次持续', operatorLabel: '超过', defaultValue: 10, unit: '秒', min: 5, max: 300, step: 5, help: '单次疑似使用手机的连续时长' }
    ] },
    { id: 'student_desk', category: 'student_class', label: '学生长时间趴桌', ruleLabel: '人数、持续时长共同判定', defaultSeverity: 'normal', criteria: [
      { id: 'people_count', label: '趴桌人数', operatorLabel: '达到', defaultValue: 1, unit: '人', min: 1, max: 50, help: '同时处于趴桌状态的学生人数' },
      { id: 'continuous_minutes', label: '连续趴桌', operatorLabel: '超过', defaultValue: 10, unit: '分钟', min: 1, max: 60, help: '单次连续趴桌的时长' }
    ] },
    { id: 'student_eating', category: 'student_class', label: '吃东西', ruleLabel: '人数、次数分别判定', defaultSeverity: 'normal', criteria: [
      { id: 'people_count', label: '涉及人数', operatorLabel: '达到', defaultValue: 1, unit: '人', min: 1, max: 50, help: '识别到吃东西行为的学生人数' },
      { id: 'eating_count', label: '行为次数', operatorLabel: '达到', defaultValue: 1, unit: '次', min: 1, max: 20, help: '课堂内识别到吃东西行为的次数' }
    ] },
    { id: 'fighting', category: 'student_break', label: '学生疑似打斗', ruleLabel: '人数、持续时长共同判定', defaultSeverity: 'serious', criteria: [
      { id: 'people_count', label: '涉及人数', operatorLabel: '达到', defaultValue: 2, unit: '人', min: 2, max: 20, help: '课间疑似参与打斗的学生人数' },
      { id: 'continuous_seconds', label: '行为持续', operatorLabel: '超过', defaultValue: 5, unit: '秒', min: 1, max: 300, help: '疑似打斗行为连续持续的时长' }
    ] },
    { id: 'chasing', category: 'student_break', label: '学生追逐打闹', ruleLabel: '人数、持续时长共同判定', defaultSeverity: 'important', criteria: [
      { id: 'people_count', label: '涉及人数', operatorLabel: '达到', defaultValue: 2, unit: '人', min: 2, max: 50, help: '课间参与追逐或打闹的学生人数' },
      { id: 'continuous_seconds', label: '行为持续', operatorLabel: '超过', defaultValue: 20, unit: '秒', min: 5, max: 600, step: 5, help: '追逐或打闹行为连续持续的时长' }
    ] }
  ];

  const metricProfiles = {
    teacher_absent: { applicableScene: '课前、课堂与下课边界', signalSource: '课表 + 教师全景', observationWindow: '上课前 10 分钟至下课后 10 分钟', aggregation: '按单节课堂分别计算迟到和早退', unavailablePolicy: '课表缺失或教师画面不可用时不输出结论', evidenceRequirement: '保留教师到岗或离岗时间点及对应画面', confidencePolicy: '人员识别与课表时间均有效时才生成异常' },
    teacher_phone: { applicableScene: '课堂中', signalSource: '教师全景', observationWindow: '整节课堂', aggregation: '同类行为按独立事件计次', unavailablePolicy: '教师画面遮挡或清晰度不足时不输出结论', evidenceRequirement: '每次事件保留前后视频片段', confidencePolicy: '达到事件识别门槛后再与次数规则比较', governanceNote: '抽烟为敏感行为，仅在学校制度允许且模型能力通过专项验收后启用。' },
    teacher_misconduct: { applicableScene: '课堂中', signalSource: '教师全景 + 课堂音频', observationWindow: '整节课堂', aggregation: '体罚与疑似语言暴力分别计次', unavailablePolicy: '音频缺失时不判断语言类观测点', evidenceRequirement: '保留对应画面、音频时间点与文本片段', confidencePolicy: '仅作为疑似线索，不替代人工事实认定', governanceNote: '属于高敏感指标，通知文案必须使用“疑似”，并限制证据访问范围。' },
    teacher_schedule: { applicableScene: '课前与课后课间', signalSource: '课表 + 教师全景 + 课堂音频', observationWindow: '上课前 10 分钟与下课后 10 分钟', aggregation: '提前到位与拖堂分别计算时长', unavailablePolicy: '课表或连续视频缺失时不输出结论', evidenceRequirement: '保留课堂边界前后的时间片段', confidencePolicy: '以课表时间为唯一边界基准' },
    teacher_attire: { applicableScene: '课堂中', signalSource: '教师全景', observationWindow: '教师可见且站立的有效画面', aggregation: '同一课堂同类着装只计一次', unavailablePolicy: '下半身不可见或遮挡时不输出结论', evidenceRequirement: '保留可辨识着装的最短必要片段', confidencePolicy: '画面质量和人体关键点均满足门槛才判断', governanceNote: '是否启用由学校制度和合规评审决定，默认不应作为教师能力评价。' },
    teacher_sitting: { applicableScene: '课堂中', signalSource: '教师全景', observationWindow: '整节课堂有效教学时段', aggregation: '累计就坐与累计站立分别汇总', unavailablePolicy: '教师持续离开画面时标记无结论', evidenceRequirement: '保留状态变化时间点并支持整段回看', confidencePolicy: '有效跟踪时长达到课堂时长 80% 才输出' },
    teacher_mandarin: { applicableScene: '课堂中', signalSource: '课堂音频', observationWindow: '有效教师语音片段', aggregation: '计算非普通话占比和最长连续时长', unavailablePolicy: '无音频、噪声过大或教师声纹不可分离时不输出结论', evidenceRequirement: '保留音频时间点与脱敏文本片段', confidencePolicy: '有效语音时长达到课堂时长 60% 才输出', governanceNote: '方言课程、双语课程及特殊教学场景应支持停用或排除。' },
    student_discipline: { applicableScene: '课堂中', signalSource: '学生全景', observationWindow: '整节课堂', aggregation: '交头接耳计次，随意走动按连续时长', unavailablePolicy: '学生画面覆盖不足时不输出结论', evidenceRequirement: '保留事件位置、时间与前后片段', confidencePolicy: '人数和行为轨迹同时满足门槛才生成线索' },
    class_count: { applicableScene: '课堂中及课堂边界', signalSource: '学生全景 + 班级应到名单', observationWindow: '开课后 5 分钟、课堂中与下课前 5 分钟', aggregation: '人数偏差、迟到人数和早退人数分别统计', unavailablePolicy: '应到人数缺失或画面无法覆盖全班时不输出结论', evidenceRequirement: '保留人数统计时点与出入画面片段', confidencePolicy: '稳定人数统计连续满足 30 秒后输出' },
    student_participation: { applicableScene: '课堂中', signalSource: '学生全景 + 课堂事件', observationWindow: '按 5 分钟窗口连续计算', aggregation: '综合举手、发言、起立和书写事件形成趋势', unavailablePolicy: '有效学生覆盖低于 70% 时标记无结论', evidenceRequirement: '保留低参与窗口及趋势数据', confidencePolicy: '仅表达课堂状态，不作为学生或教师能力评分' },
    student_phone: { applicableScene: '课堂中', signalSource: '学生全景', observationWindow: '整节课堂', aggregation: '按对象合并相邻事件并计算单次时长', unavailablePolicy: '手部区域或终端不可辨识时不输出结论', evidenceRequirement: '保留疑似使用终端的局部区域和前后片段', confidencePolicy: '物体识别与动作持续时长同时满足门槛' },
    student_desk: { applicableScene: '课堂中', signalSource: '学生全景', observationWindow: '整节课堂', aggregation: '按人数与连续趴桌时长分别判断', unavailablePolicy: '座位区域遮挡或学生不可见时不输出结论', evidenceRequirement: '保留连续状态的起止时间与画面', confidencePolicy: '连续跟踪不中断才累计时长' },
    student_eating: { applicableScene: '课堂中', signalSource: '学生全景', observationWindow: '整节课堂', aggregation: '按对象和独立行为事件计数', unavailablePolicy: '手部与口部区域不可辨识时不输出结论', evidenceRequirement: '保留事件时间、位置与前后片段', confidencePolicy: '动作与物体识别同时满足门槛' },
    fighting: { applicableScene: '课前与课后课间', signalSource: '学生全景', observationWindow: '课前 10 分钟与课后 10 分钟', aggregation: '按参与人数和连续行为时长判断', unavailablePolicy: '课间视频缺失或人群严重遮挡时不输出结论', evidenceRequirement: '保留事件全程、参与区域和前后片段', confidencePolicy: '仅生成“疑似打斗”线索，不自动作事实定性', governanceNote: '应提供快速回看，不自动产生纪律处分结论。' },
    chasing: { applicableScene: '课前与课后课间', signalSource: '学生全景', observationWindow: '课前 10 分钟与课后 10 分钟', aggregation: '按参与人数和连续移动轨迹判断', unavailablePolicy: '课间视频缺失或轨迹不可连续跟踪时不输出结论', evidenceRequirement: '保留完整追逐轨迹和前后片段', confidencePolicy: '排除正常进出教室后再生成线索' }
  };

  anomalyTypes.forEach((item) => Object.assign(item, metricProfiles[item.id] || {}));

  const categories = {
    teacher: '教师课堂行为',
    student_class: '学生课堂行为',
    student_break: '学生课间行为'
  };

  const categoryGroups = {
    teacher: { label: '教师课堂行为', categoryIds: ['teacher'] },
    student: { label: '学生行为', categoryIds: ['student_class', 'student_break'] }
  };

  const categoryScenes = {
    teacher: '',
    student_class: '课堂中',
    student_break: '课间'
  };

  const statusLabels = {
    waiting: '等待视频',
    analyzing: '分析中',
    complete_none: '分析完成—无异常',
    complete_issue: '分析完成—有疑似线索',
    partial: '分析完成—部分失败',
    failed: '分析失败'
  };

  const resultLabels = {
    unprocessed: '未处理',
    formal: '正式问题',
    false: '误报',
    uncertain: '暂不确定',
    deleted: '人工删除'
  };

  const severityLabels = { normal: '一般', important: '重要', serious: '严重' };

  function day(offset, hour, minute) {
    const d = new Date(DEMO_NOW);
    d.setDate(d.getDate() - offset);
    d.setHours(hour || 9, minute || 0, 0, 0);
    return d.toISOString();
  }

  function anomalyOccurrenceSecond(anomalyType, session, clueIndex, anomalyIndex) {
    const durationSeconds = session.duration * 60;
    const breakSeconds = Math.min(600, Math.floor(durationSeconds / 3));
    const classStart = breakSeconds;
    const classEnd = Math.max(classStart, durationSeconds - breakSeconds);
    const breakOnly = anomalyType.category === 'student_break' || anomalyType.scene === 'break';
    const offsetSeed = clueIndex * 173 + anomalyIndex * 221;
    if (breakOnly) {
      const useEndingBreak = (clueIndex + anomalyIndex) % 2 === 1;
      if (!useEndingBreak) return 120 + (offsetSeed % Math.max(60, breakSeconds - 240));
      return classEnd + 90 + (offsetSeed % Math.max(60, durationSeconds - classEnd - 180));
    }
    const safeStart = Math.min(classEnd - 90, classStart + 90);
    const safeSpan = Math.max(60, classEnd - safeStart - 90);
    return safeStart + (offsetSeed % safeSpan);
  }

  function createSeedData() {
    const region = { id: 'r1', name: '青川区' };
    const schools = [
      { id: 's1', regionId: 'r1', name: '青川实验小学', shortName: '实验小学' },
      { id: 's2', regionId: 'r1', name: '春华中学', shortName: '春华中学' },
      { id: 's3', regionId: 'r1', name: '启明小学', shortName: '启明小学' }
    ];
    const classes = [
      { id: 'c11', schoolId: 's1', name: '三年级1班', expected: 42, homeroomId: 'p12' },
      { id: 'c12', schoolId: 's1', name: '四年级2班', expected: 40, homeroomId: 'p13' },
      { id: 'c13', schoolId: 's1', name: '五年级1班', expected: 45, homeroomId: 'p14' },
      { id: 'c21', schoolId: 's2', name: '七年级3班', expected: 48, homeroomId: 'p22' },
      { id: 'c22', schoolId: 's2', name: '八年级2班', expected: 46, homeroomId: 'p23' },
      { id: 'c31', schoolId: 's3', name: '二年级2班', expected: 38, homeroomId: 'p32' },
      { id: 'c32', schoolId: 's3', name: '六年级1班', expected: 43, homeroomId: 'p33' }
    ];
    const people = [
      { id: 'p10', schoolId: 's1', name: '林静', role: '校级管理员', position: '教导主任' },
      { id: 'p11', schoolId: 's1', name: '李明远', role: '任课教师' },
      { id: 'p12', schoolId: 's1', name: '周雨桐', role: '班主任' },
      { id: 'p13', schoolId: 's1', name: '王海燕', role: '班主任' },
      { id: 'p14', schoolId: 's1', name: '陈思远', role: '任课教师' },
      { id: 'p15', schoolId: 's1', name: '谢文华', role: '校级管理员', position: '校长/副校长' },
      { id: 'p16', schoolId: 's1', name: '马睿', role: '校级管理员', position: '教研组长' },
      { id: 'p20', schoolId: 's2', name: '方立新', role: '校级管理员', position: '教导主任' },
      { id: 'p21', schoolId: 's2', name: '赵文博', role: '任课教师' },
      { id: 'p22', schoolId: 's2', name: '刘晓晴', role: '班主任' },
      { id: 'p23', schoolId: 's2', name: '孙嘉诚', role: '班主任' },
      { id: 'p24', schoolId: 's2', name: '杜若岚', role: '校级管理员', position: '校长/副校长' },
      { id: 'p25', schoolId: 's2', name: '顾明川', role: '校级管理员', position: '教研组长' },
      { id: 'p30', schoolId: 's3', name: '郑欣', role: '校级管理员', position: '教导主任' },
      { id: 'p31', schoolId: 's3', name: '吴佳宁', role: '任课教师' },
      { id: 'p32', schoolId: 's3', name: '何俊杰', role: '班主任' },
      { id: 'p33', schoolId: 's3', name: '张雅婷', role: '班主任' },
      { id: 'p34', schoolId: 's3', name: '许安澜', role: '校级管理员', position: '校长/副校长' },
      { id: 'p35', schoolId: 's3', name: '蒋书言', role: '校级管理员', position: '教研组长' },
      { id: 'p90', regionId: 'r1', name: '宋倩', role: '区域管理员' },
      { id: 'p91', regionId: 'r1', name: '高云峰', role: '区域教研员' }
    ];
    const rooms = [
      { id: 'rm11', schoolId: 's1', name: '博学楼301录播教室', cameras: 3, hasVideo: true },
      { id: 'rm12', schoolId: 's1', name: '启智楼402录播教室', cameras: 2, hasVideo: true },
      { id: 'rm13', schoolId: 's1', name: '综合楼报告厅', cameras: 3, hasVideo: true },
      { id: 'rm21', schoolId: 's2', name: '求真楼201录播教室', cameras: 2, hasVideo: true },
      { id: 'rm22', schoolId: 's2', name: '格物楼305录播教室', cameras: 3, hasVideo: true },
      { id: 'rm31', schoolId: 's3', name: '启明楼101录播教室', cameras: 2, hasVideo: true },
      { id: 'rm32', schoolId: 's3', name: '启明楼203录播教室', cameras: 2, hasVideo: true }
    ];
    const schoolMap = {
      s1: { classes: ['c11', 'c12', 'c13'], teachers: ['p11', 'p12', 'p13', 'p14'], rooms: ['rm11', 'rm12', 'rm13'] },
      s2: { classes: ['c21', 'c22'], teachers: ['p21', 'p22', 'p23'], rooms: ['rm21', 'rm22'] },
      s3: { classes: ['c31', 'c32'], teachers: ['p31', 'p32', 'p33'], rooms: ['rm31', 'rm32'] }
    };

    const sessions = [];
    let sessionNo = 1;
    const subjects = ['语文', '数学', '英语', '科学', '道德与法治'];
    schools.forEach((school, schoolIndex) => {
      const count = school.id === 's1' ? 12 : 8;
      for (let i = 0; i < count; i += 1) {
        const map = schoolMap[school.id];
        sessions.push({
          id: `ss${sessionNo}`,
          schoolId: school.id,
          classId: map.classes[i % map.classes.length],
          teacherId: map.teachers[i % map.teachers.length],
          roomId: map.rooms[i % map.rooms.length],
          subject: subjects[(i + schoolIndex) % subjects.length],
          startAt: day(1 + ((i * 2 + schoolIndex) % 28), 8 + (i % 5), i % 2 ? 40 : 0),
          duration: 40 + (i % 3) * 5,
          cameraCount: rooms.find((r) => r.id === map.rooms[i % map.rooms.length]).cameras,
          videoDeleted: school.id === 's1' && i === 7
        });
        sessionNo += 1;
      }
    });

    const taskCycle = ['complete_issue', 'complete_issue', 'complete_none', 'partial', 'complete_issue', 'failed', 'waiting', 'analyzing'];
    const tasks = sessions.map((session, index) => {
      const status = taskCycle[index % taskCycle.length];
      const failures = status === 'partial'
        ? [
            { typeId: 'student_discipline', reason: '关键画面清晰度不足' },
            { typeId: 'student_phone', reason: '该画面清晰度不足' }
          ]
        : status === 'failed'
          ? [{ typeId: 'all', reason: index % 2 ? '课堂结束后24小时仍未获取到录播视频' : '视频文件损坏，无法解析' }]
          : [];
      return {
        id: `task${index + 1}`,
        sessionId: session.id,
        status,
        videoStatus: session.videoDeleted ? 'deleted' : status === 'waiting' ? 'waiting' : 'ready',
        createdAt: session.startAt,
        completedAt: ['complete_issue', 'complete_none', 'partial', 'failed'].includes(status) ? day(Math.max(0, 1 + (index % 27)), 17, 20) : null,
        failures,
        modelVersion: `classroom-ai-2.${3 + (index % 3)}`,
        ruleSnapshot: { version: `R${1 + (index % 4)}.0`, capturedAt: session.startAt }
      };
    });

    const issueTasks = tasks.filter((t) => ['complete_issue', 'partial'].includes(t.status));
    const resultPatterns = [
      ['unprocessed', 'unprocessed'],
      ['formal', 'uncertain'],
      ['formal', 'false'],
      ['false'],
      ['formal', 'formal'],
      ['uncertain', 'unprocessed'],
      ['deleted'],
      ['formal']
    ];
    const clues = issueTasks.map((task, index) => {
      const session = sessions.find((s) => s.id === task.sessionId);
      const categoryList = ['teacher', 'student_class', 'student_break'];
      const category = categoryList[index % categoryList.length];
      const types = anomalyTypes.filter((t) => t.category === category);
      const pattern = resultPatterns[index % resultPatterns.length];
      const classInfo = classes.find((c) => c.id === session.classId);
      const anomalies = pattern.map((result, anomalyIndex) => {
        const type = types[(index * 2 + anomalyIndex) % types.length];
        const isTeacher = category === 'teacher';
        const recipients = result === 'formal'
          ? [isTeacher ? session.teacherId : classInfo.homeroomId]
          : [];
        return {
          id: `a${index + 1}_${anomalyIndex + 1}`,
          source: index === 5 && anomalyIndex === 1 ? 'manual' : 'ai',
          typeId: type.id,
          category,
          objectKind: isTeacher ? 'teacher' : anomalyIndex % 2 ? 'position' : 'class',
          teacherId: isTeacher ? session.teacherId : null,
          classId: isTeacher ? null : session.classId,
          position: isTeacher ? '讲台及主要教学区域' : anomalyIndex % 2 ? '画面右侧第二区域' : '整个班级',
          occurredSecond: anomalyOccurrenceSecond(type, session, index, anomalyIndex),
          evidence: [],
          result,
          severity: type.defaultSeverity,
          recipients,
          submitted: result !== 'unprocessed',
          repeat: type.id === 'teacher_sitting' && session.teacherId === 'p11',
          confidence: 88 + ((index + anomalyIndex) % 8),
          rationale: `${type.criteria?.[0]?.label || type.label}观测结果达到学校当前判定定义`,
          deleted: result === 'deleted'
        };
      });
      anomalies.forEach((anomaly, anomalyIndex) => {
        anomaly.evidence = [{ id: `e${index}_${anomalyIndex}_1`, start: Math.max(0, anomaly.occurredSecond - 20), end: Math.min(session.duration * 60, anomaly.occurredSecond + 32), camera: 1 }];
      });
      const hasSubmitted = anomalies.some((a) => a.submitted);
      return {
        id: `clue${index + 1}`,
        taskId: task.id,
        sessionId: session.id,
        category,
        aiCreatedAt: day(Math.max(0, 1 + (index % 27)), 18, 5),
        aiOriginalCount: anomalies.filter((a) => a.source === 'ai').length,
        revision: hasSubmitted ? 2 : 1,
        lastUpdatedAt: hasSubmitted ? day(Math.max(0, index % 20), 16, 30) : null,
        lastUpdatedBy: hasSubmitted ? (index % 2 ? '林静' : '方立新') : null,
        remoteRevision: null,
        anomalies,
        history: hasSubmitted
          ? [{
              version: 1,
              author: index % 2 ? '林静' : '方立新',
              at: day(Math.max(0, index % 20), 16, 30),
              summary: '完成首次核查提交',
              diff: `正式问题 ${anomalies.filter((a) => a.result === 'formal').length} 项，误报 ${anomalies.filter((a) => a.result === 'false').length} 项，暂不确定 ${anomalies.filter((a) => a.result === 'uncertain').length} 项`,
              snapshot: JSON.parse(JSON.stringify(anomalies))
            }]
          : []
      };
    });

    // 让李明远在近30天重复出现同一类型，支持重点提醒演示。
    clues.filter((clue) => clue.category === 'teacher').slice(0, 3).forEach((clue) => {
      const session = sessions.find((s) => s.id === clue.sessionId);
      session.teacherId = 'p11';
      clue.anomalies.forEach((a) => {
        a.teacherId = 'p11';
        if (a.typeId === 'teacher_sitting' || a.typeId === 'teacher_absent') a.repeat = true;
      });
    });

    const rules = {};
    schools.forEach((school, idx) => {
      const schoolRooms = rooms.filter((r) => r.schoolId === school.id);
      rules[school.id] = {
        version: `R${idx + 2}.0`,
        updatedAt: day(4 + idx, 15, 0),
        effectiveFrom: day(4 + idx, 15, 0),
        updatedBy: idx === 0 ? '林静' : idx === 1 ? '方立新' : '郑欣',
        enabledRooms: schoolRooms.map((r) => r.id),
        enabledTypes: anomalyTypes.reduce((acc, t) => { acc[t.id] = t.defaultEnabled !== false; return acc; }, {}),
        thresholds: anomalyTypes.reduce((acc, t) => { acc[t.id] = t.criteria?.[0]?.defaultValue ?? null; return acc; }, {}),
        criteria: anomalyTypes.reduce((acc, t) => {
          acc[t.id] = Object.fromEntries((t.criteria || []).map((criterion) => [criterion.id, criterion.defaultValue]));
          return acc;
        }, {}),
        severityDefaults: anomalyTypes.reduce((acc, t) => { acc[t.id] = t.defaultSeverity; return acc; }, {}),
        repeat: anomalyTypes.filter((t) => t.category === 'teacher').reduce((acc, t) => {
          acc[t.id] = { days: 30, times: 3 };
          return acc;
        }, {}),
        notifyTeacher: ['role:teacher'],
        notifyStudent: ['role:homeroom'],
        allowFullVideo: idx === 0
      };
    });

    const formalIssues = [];
    clues.forEach((clue) => {
      clue.anomalies.filter((a) => a.result === 'formal' && !a.deleted).forEach((a) => {
        formalIssues.push({
          id: `fi_${clue.id}_${a.id}`,
          clueId: clue.id,
          anomalyId: a.id,
          active: true,
          severity: a.severity,
          repeat: !!a.repeat,
          source: a.source,
          createdAt: clue.lastUpdatedAt || clue.aiCreatedAt
        });
      });
    });

    const notifications = [];
    let noticeNo = 1;
    clues.forEach((clue) => {
      const session = sessions.find((s) => s.id === clue.sessionId);
      const byRecipient = {};
      clue.anomalies.filter((a) => a.result === 'formal' && !a.deleted).forEach((a) => {
        a.recipients.forEach((recipientId) => {
          if (!byRecipient[recipientId]) byRecipient[recipientId] = [];
          byRecipient[recipientId].push(a.id);
        });
      });
      Object.entries(byRecipient).forEach(([recipientId, anomalyIds]) => {
        const afterSnapshot = clue.anomalies.filter((a) => anomalyIds.includes(a.id)).map((a) => JSON.parse(JSON.stringify(a)));
        notifications.push({
          id: `n${noticeNo}`,
          schoolId: session.schoolId,
          sessionId: session.id,
          clueId: clue.id,
          recipientId,
          kind: 'formal',
          title: '课堂巡课问题提醒',
          sentAt: clue.lastUpdatedAt || clue.aiCreatedAt,
          anomalyIds,
          before: [],
          after: anomalyIds,
          beforeSnapshot: [],
          afterSnapshot,
          read: noticeNo % 3 !== 0
        });
        noticeNo += 1;
      });
    });

    // 提供更正和撤回通知初始样例。
    if (notifications.length >= 2) {
      const correctionBefore = JSON.parse(JSON.stringify(notifications[0].afterSnapshot));
      const correctionAfter = JSON.parse(JSON.stringify(correctionBefore.slice(0, 1)));
      if (correctionAfter[0]) correctionAfter[0].occurredSecond += 90;
      notifications.push({ ...notifications[0], id: `n${noticeNo++}`, kind: 'correction', title: '课堂巡课问题更正通知', sentAt: day(1, 17, 20), before: notifications[0].anomalyIds, after: notifications[0].anomalyIds.slice(0, 1), beforeSnapshot: correctionBefore, afterSnapshot: correctionAfter, read: false });
      notifications.push({ ...notifications[1], id: `n${noticeNo++}`, kind: 'withdraw', title: '课堂巡课问题撤回通知', sentAt: day(2, 11, 10), before: notifications[1].anomalyIds, after: [], beforeSnapshot: JSON.parse(JSON.stringify(notifications[1].afterSnapshot)), afterSnapshot: [], read: true });
    }

    return {
      schemaVersion: 17,
      demoVersion: DEMO_VERSION,
      generatedAt: DEMO_NOW,
      region,
      schools,
      classes,
      people,
      rooms,
      sessions,
      tasks,
      clues,
      formalIssues,
      notifications,
      rules,
      anomalyTypes,
      categories,
      categoryGroups,
      categoryScenes,
      statusLabels,
      resultLabels,
      severityLabels
    };
  }

  window.AIPCDemoData = {
    DEMO_NOW,
    DEMO_VERSION,
    anomalyTypes,
    categories,
    categoryGroups,
    categoryScenes,
    statusLabels,
    resultLabels,
    severityLabels,
    createSeedData
  };
})();
