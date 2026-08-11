(function () {
  const DEMO_NOW = '2026-08-06T10:00:00+08:00';
  const anomalyTypes = [
    { id: 'teacher_absent', category: 'teacher', label: '教师考勤', ruleLabel: '观测点：迟到、早退', defaultSeverity: 'important', configurable: false, observationPoints: ['迟到', '早退'] },
    { id: 'teacher_phone', category: 'teacher', label: '教师异常行为', ruleLabel: '观测点：使用手机、打电话、抽烟', defaultSeverity: 'serious', configurable: false, observationPoints: ['使用手机', '打电话', '抽烟'] },
    { id: 'teacher_misconduct', category: 'teacher', label: '体罚辱生', ruleLabel: '观测点：体罚、语言暴力', defaultSeverity: 'serious', configurable: false, observationPoints: ['体罚', '语言暴力'] },
    { id: 'teacher_schedule', category: 'teacher', label: '课间行为情况', ruleLabel: '观测点：提前到位、拖堂', defaultSeverity: 'important', configurable: false, observationPoints: ['提前到位', '拖堂'] },
    { id: 'teacher_attire', category: 'teacher', label: '教师着装', ruleLabel: '观测点：3 分裤、5 分裤', defaultSeverity: 'normal', configurable: false, observationPoints: ['3 分裤', '5 分裤'] },
    { id: 'teacher_sitting', category: 'teacher', label: '教师就坐', ruleLabel: '观测点：就坐时长、站立时长', defaultSeverity: 'normal', configurable: false, observationPoints: ['就坐时长', '站立时长'] },
    { id: 'teacher_mandarin', category: 'teacher', label: '不使用普通话教学', ruleLabel: '按课堂语音识别规则判断', defaultSeverity: 'normal', configurable: false },
    { id: 'student_discipline', category: 'student_class', label: '纪律情况', ruleLabel: '交头接耳、随意走动', defaultSeverity: 'normal', configurable: false },
    { id: 'class_count', category: 'student_class', label: '课堂人数异常', ruleLabel: '含迟到、早退', defaultSeverity: 'important', threshold: 20, unit: '%偏差' },
    { id: 'student_participation', category: 'student_class', label: '学生参与度低', ruleLabel: '参与度低于学校设定范围', defaultSeverity: 'normal', configurable: false },
    { id: 'student_phone', category: 'student_class', label: '学生疑似使用手机', ruleLabel: '按疑似行为事件识别', defaultSeverity: 'important', threshold: 1, unit: '次' },
    { id: 'student_desk', category: 'student_class', label: '学生长时间趴桌', ruleLabel: '持续趴桌时长', defaultSeverity: 'normal', threshold: 10, unit: '分钟' },
    { id: 'student_eating', category: 'student_class', label: '吃东西', ruleLabel: '按课堂行为事件识别', defaultSeverity: 'normal', threshold: 1, unit: '次' },
    { id: 'fighting', category: 'student_break', label: '学生疑似打斗', ruleLabel: '按疑似行为事件识别', defaultSeverity: 'serious', threshold: 1, unit: '次' },
    { id: 'chasing', category: 'student_break', label: '学生追逐打闹', ruleLabel: '持续追逐或打闹行为', defaultSeverity: 'important', threshold: 20, unit: '秒' },
    { id: 'break_smoking', category: 'student_break', label: '学生疑似抽烟', ruleLabel: '按疑似行为事件识别', defaultSeverity: 'important', threshold: 1, unit: '次' }
  ];

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
          occurredSecond: 260 + ((index * 173 + anomalyIndex * 221) % Math.max(800, session.duration * 60 - 300)),
          evidence: [{ id: `e${index}_${anomalyIndex}_1`, start: 240 + anomalyIndex * 160, end: 292 + anomalyIndex * 160, camera: 1 }],
          result,
          severity: type.defaultSeverity,
          recipients,
          submitted: result !== 'unprocessed',
          repeat: type.id === 'teacher_sitting' && session.teacherId === 'p11',
          deleted: result === 'deleted'
        };
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
        enabledRooms: schoolRooms.map((r) => r.id),
        enabledTypes: anomalyTypes.reduce((acc, t) => { acc[t.id] = t.defaultEnabled !== false; return acc; }, {}),
        thresholds: anomalyTypes.reduce((acc, t) => { acc[t.id] = t.threshold == null ? null : t.threshold; return acc; }, {}),
        severityDefaults: anomalyTypes.reduce((acc, t) => { acc[t.id] = t.defaultSeverity; return acc; }, {}),
        repeat: anomalyTypes.filter((t) => t.category === 'teacher').reduce((acc, t) => {
          acc[t.id] = { days: 30, times: 3 };
          return acc;
        }, {}),
        notifyTeacher: [],
        notifyStudent: [],
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
      schemaVersion: 14,
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
