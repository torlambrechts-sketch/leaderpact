(function () {
  const VERSION = 'v5.0';
  const THEMES = [
    { id: 'purpose', label: 'Purpose and priorities' },
    { id: 'meetings', label: 'Meetings' },
    { id: 'dialogue', label: 'Dialogue and conflict' },
    { id: 'oneteam', label: 'Working as one team' },
    { id: 'safety', label: 'Safety and trust' },
    { id: 'results', label: 'Results' }
  ];
  const SCAN = [
    ['We agree on what this leadership team is for.', 0],
    ['We know which few priorities matter most right now.', 0],
    ['Each item in our meetings has a clear desired outcome.', 1],
    ['Our meetings stay on the topic at hand.', 1],
    ["We question each other's ideas openly in meetings.", 2],
    ['Disagreements here stay about the issue, not the person.', 2],
    ['We act on what is best for the whole company, not only our own units.', 3],
    ['We share information with each other without being asked.', 3],
    ['It is safe to admit a mistake in this team.', 4],
    ['I can count on the others to do what they say.', 4],
    ['This team makes decisions that stick.', 5],
    ['Being part of this team helps me grow as a leader.', 5]
  ];
  const OPTS = ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'];
  const SEED = [
    [4, 3, 3, 3.5, 4, 3.5], [4, 1.5, 3, 3, 4.5, 4], [3.5, 4, 3.5, 4, 4, 3.5], [4.5, 1.5, 2.5, 3, 4, 3.5],
    [4, 4.5, 3, 3.5, 4.5, 4], [3.5, 2, 3.5, 3.5, 3.5, 3], [4, 3.5, 3, 3.5, 4, 3.5]
  ];
  const MEMBERS = [
    { id: 'kn', name: 'Kari Nordmann', role: 'Chief executive', initials: 'KN', leader: true, tone: 0 },
    { id: 'oh', name: 'Ola Hansen', role: 'Finance', initials: 'OH', tone: 1 },
    { id: 'ib', name: 'Ingrid Berg', role: 'Operations', initials: 'IB', tone: 2 },
    { id: 'lj', name: 'Lars Johansen', role: 'Product', initials: 'LJ', tone: 3 },
    { id: 'sl', name: 'Sofie Lie', role: 'People', initials: 'SL', tone: 4 },
    { id: 'ed', name: 'Erik Dahl', role: 'Sales', initials: 'ED', tone: 5 },
    { id: 'ms', name: 'Maja Strand', role: 'Marketing', initials: 'MS', tone: 6 },
    { id: 'hb', name: 'Henrik Bakke', role: 'Technology', initials: 'HB', tone: 7 }
  ];
  const ME = {
    leader: { id: 'kn', name: 'Kari Nordmann', first: 'Kari', initials: 'KN', title: 'Team leader' },
    member: { id: 'lj', name: 'Lars Johansen', first: 'Lars', initials: 'LJ', title: 'Member' },
    coach: { id: 'av', name: 'Anne Vik', first: 'Anne', initials: 'AV', title: 'Coach' }
  };
  const LAYERS = [['conditions', 'Conditions'], ['processes', 'Processes'], ['states', 'States'], ['outcomes', 'Outcomes']];
  const SCALE_ROWS = [
    ['purpose', 'Clear purpose', 'conditions', 'Strong', 'higher', 3.6, 3.9, 'high'],
    ['teamTasks', 'Team tasks', 'conditions', 'Moderate', 'higher', 3.0, 3.4, 'medium'],
    ['size', 'Size and membership', 'conditions', 'Mixed', 'descriptive', 3.5, 3.5, 'high'],
    ['composition', 'Composition', 'conditions', 'Mixed', 'descriptive', 3.3, 3.4, 'medium'],
    ['rewards', 'Rewards', 'conditions', 'Moderate', 'higher', 2.8, 2.9, 'low'],
    ['info', 'Information and support', 'conditions', 'Moderate', 'higher', 3.2, 3.3, 'medium'],
    ['preparation', 'Preparation', 'processes', 'Not yet rated', 'higher', 3.2, 3.4, 'medium'],
    ['meetingGoals', 'Meeting goals', 'processes', 'Moderate', 'higher', 2.8, 3.3, 'medium'],
    ['focus', 'Focus', 'processes', 'Moderate', 'higher', 2.7, 3.0, 'low'],
    ['dialogue', 'Dialogue', 'processes', 'Moderate', 'higher', 3.0, 2.9, 'medium'],
    ['taskConflict', 'Task conflict', 'processes', 'Moderate', 'conditional', 2.5, 2.4, 'medium'],
    ['relConflict', 'Relationship conflict', 'processes', 'Strong', 'lower', 2.0, 1.9, 'high'],
    ['political', 'Political behaviour', 'processes', 'Moderate', 'lower', 2.3, 2.2, 'high'],
    ['integration', 'Behavioural integration', 'processes', 'Strong', 'higher', 3.3, 3.5, 'high'],
    ['external', 'External relations', 'processes', 'Not yet rated', 'higher', 3.6, 3.7, 'high'],
    ['learning', 'Learning', 'processes', 'Moderate', 'higher', 3.0, 3.1, 'medium'],
    ['leadership', 'Team leadership', 'processes', 'Strong', 'higher', 3.6, 3.9, 'high'],
    ['safety', 'Psychological safety', 'states', 'Strong', 'higher', 3.8, 3.9, 'high'],
    ['trust', 'Trust', 'states', 'Strong', 'higher', 3.7, 3.8, 'high'],
    ['cohesion', 'Cohesion', 'states', 'Strong', 'higher', 3.5, 3.6, 'medium'],
    ['norms', 'Norms', 'states', 'Not yet rated', 'higher', 3.1, 3.2, 'medium'],
    ['dac', 'Direction, alignment and commitment', 'outcomes', 'Self-rated', 'higher', 3.5, 3.8, 'high'],
    ['viability', 'Viability', 'outcomes', 'Self-rated', 'higher', 3.5, 3.6, 'medium'],
    ['growth', 'Member growth', 'outcomes', 'Self-rated', 'higher', 3.1, 3.2, 'low']
  ];
  const ITEMS = {
    purpose: ['We agree on what this team is for.', 'Our purpose is clear enough to say no to things.', 'I could explain our purpose to a new member in a minute.'],
    teamTasks: ['We know which decisions belong to this team.', 'Items reach us only when they need the whole group.', 'We know which tasks we own together.'],
    size: ['The team has the people it needs, and no more.', 'It is clear who is a member of this team.', 'Membership has been stable this year.'],
    composition: ['Between us we cover the skills the company needs.', 'We bring different views to most topics.', 'New perspectives get a fair hearing.'],
    rewards: ['We are recognised for team results, not only unit results.', 'Our goals reward working together.', 'What gets rewarded matches what we say matters.'],
    info: ['We get the information we need to decide well.', 'We have support when we need it.', 'Data reaches us in time for our meetings.'],
    preparation: ['Pre-reads arrive in time to read them.', 'Members come to meetings prepared.', 'Item owners know what is expected of them.'],
    meetingGoals: ['Each agenda item has a clear desired outcome.', 'I know why an item is on the agenda.', 'We know when an item is finished.'],
    focus: ['Our discussions stay on the item at hand.', 'We spend time on what matters most.', 'Side topics are parked rather than chased.'],
    dialogue: ["We build on each other's ideas.", 'Everyone gets a chance to speak.', 'We ask questions before we argue.'],
    taskConflict: ['We disagree openly about ideas.', 'Different views on the work come up in meetings.', 'We debate options before deciding.'],
    relConflict: ['There is friction between some members.', 'Disagreements here turn personal.', 'Some members avoid each other.'],
    political: ['Some members pursue hidden agendas.', 'Deals are made outside the meeting.', 'People protect their own turf.'],
    integration: ['We share information freely across units.', 'We make decisions together, not in silos.', 'We help each other meet deadlines.'],
    external: ['We keep key stakeholders informed.', 'We seek input from outside the team.', 'We represent the team well to others.'],
    learning: ['We look back on what worked and what did not.', 'We change how we work when something fails.', 'We ask others for feedback on the team.'],
    leadership: ['The team leader sets a clear direction for us.', 'The leader invites input before deciding.', 'The leader handles tension well.'],
    safety: ['It is safe to take a risk in this team.', 'I can raise a problem without being blamed.', 'No one here would undermine my efforts.'],
    trust: ['I can count on the others to deliver.', 'Members keep confidences.', 'We assume good intent.'],
    cohesion: ['We feel like one team.', 'Members want to stay in this team.', 'We enjoy working together.'],
    norms: ['We follow our working agreements.', 'We call it out when someone breaks a norm.', 'New members learn our norms fast.'],
    dac: ['We agree on where the company is going.', 'Our work is aligned across units.', 'We are committed to the decisions we make.'],
    viability: ['This team could keep working well for years.', 'We have the energy to take on more.', 'We would choose to work together again.'],
    growth: ['Being on this team helps me grow.', 'I learn from the other members.', 'The team makes me a better leader.']
  };
  const SCALES = SCALE_ROWS.map(r => ({ id: r[0], label: r[1], layer: r[2], ev: r[3], read: r[4], r1: r[5], r2: r[6], ag: r[7] }));
  const SC = {}; SCALES.forEach(x => SC[x.id] = x);
  const AG = { high: 'High agreement', medium: 'Medium agreement', low: 'Views differ' };
  const READ_NOTE = { lower: 'Lower is better', conditional: 'Read with relationship conflict', descriptive: 'Descriptive, no target' };
  const PRACTICES = [
    { id: 'outcomeFirst', name: 'Outcome first', scale: 'meetingGoals', format: '5-minute meeting practice', types: ['Decision', 'Discussion'], steps: ['The item owner states the desired outcome in one sentence.', 'The group checks whether it is a decision, a discussion or information.', 'The leader restates the outcome before closing the item.'] },
    { id: 'round', name: 'Structured round', scale: 'dialogue', format: '5-minute meeting practice', types: ['Decision', 'Discussion'], steps: ['Each member states their position in one sentence.', 'No replies until everyone has spoken.', 'Then open the discussion.'] },
    { id: 'processNorm', name: 'Process-comment norm', scale: 'focus', format: '5-minute meeting practice', types: ['Discussion'], steps: ['Agree that anyone can use the two process comments.', 'The leader answers every comment out loud.', 'Review the count at the end of the meeting.'] },
    { id: 'parkingLot', name: 'Parking lot', scale: 'focus', format: '5-minute meeting practice', types: ['Discussion', 'Information'], steps: ['Keep a visible list of side topics.', 'Park anything that does not serve the desired outcome.', 'Give each parked topic an owner before closing.'] },
    { id: 'lessons', name: 'Lessons round', scale: 'safety', format: '1-hour workshop', types: [], steps: ['Each member shares one recent mistake and the lesson.', 'The leader goes first.', 'The group names one change to make.'] },
    { id: 'tasksWorkshop', name: 'Team tasks workshop', scale: 'teamTasks', format: '1-hour workshop', types: [], steps: ['List every recurring item from the last 3 months.', 'Sort each into decide, advise, inform or not ours.', 'Update the charter with the result.'] },
    { id: 'leaderLast', name: 'Leader speaks last', scale: 'leadership', format: 'Leader action', types: ['Decision'], steps: ['On decision items the leader holds back their view.', 'Ask each member for theirs first.', 'Then decide and say why.'] },
    { id: 'decisionLog', name: 'Joint decision log', scale: 'integration', format: '5-minute meeting practice', types: ['Decision'], steps: ['Log each decision with an owner before moving on.', 'Name the units it affects.', 'Read the log back at the end.'] }
  ];
  const TYPES = ['Information', 'Discussion', 'Decision', 'Follow-up'];
  const RIGHTS = ['Decide', 'Advise', 'Inform'];
  const TASK_TIME = { t1: '6 h 40 min', t2: '3 h 10 min', t3: '2 h 05 min', t4: '1 h 15 min' };
  const PULSE_LABELS = ['R1 · Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'R2 · Sep'];
  const DOMAINS = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'];
  const FACETS = ['Self-efficacy', 'Orderliness', 'Dutifulness', 'Achievement-striving', 'Self-discipline', 'Cautiousness'];
  const PROFILES = {
    leader: { pos: [82, 74, 52, 46, 22], facets: [78, 40, 70, 85, 64, 30], desc: ['Seeks new ideas; at home in abstract strategy work.', 'Plans ahead and follows through; may push for structure early.', 'Equally at home leading a room and working alone.', 'Balances warmth with a willingness to challenge.', "Stays even under pressure; may underread others' stress."], prompt: 'You sit higher on Openness than most who share. Which ideas does the group drop too early?', test: 'Full profile, IPIP-NEO-120 · 120 items · completed 14 September 2026' },
    member: { pos: [64, 48, 70, 58, 40], facets: [60, 35, 55, 62, 50, 45], desc: ['Open to new ideas while keeping an eye on what works.', 'Flexible about plans; follows through on what matters most.', 'Energised by discussion; often speaks first.', 'Cooperative, and willing to push back when needed.', 'Usually steady; feels pressure in crunch periods.'], prompt: 'You sit higher on Extraversion than most who share. Who in the group needs more room to speak first?', test: 'Quick profile, Mini-IPIP · 20 items · completed today' }
  };
  const MODULES = [
    { id: 'humility', name: 'Integrity and humility', items: '40 items' },
    { id: 'style', name: 'Interaction style', items: '32 items' },
    { id: 'strengths', name: 'Leadership strengths', items: '7 scales' }
  ];
  const NAV = [
    { id: 'home', label: 'Home', icon: 'lucide:house' },
    { id: 'group', label: 'Group', icon: 'lucide:users', paid: true, coach: true },
    { id: 'people', label: 'People', icon: 'lucide:contact', paid: true },
    { id: 'assess', label: 'Assess', icon: 'lucide:calendar-check', paid: true, coach: true },
    { id: 'results', label: 'Results', icon: 'lucide:trending-up', paid: true, coach: true },
    { id: 'develop', label: 'Plan', icon: 'lucide:kanban', paid: true, coach: true },
    { id: 'meetings', label: 'Meetings', icon: 'lucide:calendar-clock', paid: true, coach: true },
    { id: 'cxo', label: '360', icon: 'lucide:radar', paid: true },
    { id: 'me', label: 'Me', icon: 'lucide:user' }
  ];
  const SCREENS = [['landing', 'Landing'], ['scan', 'Scan'], ['personal', 'Personal view'], ['invite', 'Invite'], ['team', 'Team view'], ['home', 'Home'], ['group', 'Group'], ['people', 'People'], ['person', 'Person'], ['overview', 'Assess status'], ['library', 'Library'], ['schedule', 'Schedule'], ['pulse', 'Pulse setup'], ['tests', 'Individual'], ['results', 'Results'], ['standing', 'Standing'], ['plan', 'Plan'], ['series', 'Meeting series'], ['agenda', 'Agenda'], ['live', 'Live meeting'], ['checkin', 'Check-in'], ['log', 'Decision log'], ['audit', 'Meeting audit'], ['c360', 'CXO 360'], ['me', 'Me'], ['settings', 'Settings']];
  const PUBLIC = ['landing', 'scan', 'personal', 'invite', 'team'];
  const ROUTES = PUBLIC.concat(['home', 'group', 'people', 'assess', 'results', 'develop', 'meetings', 'me', 'settings', 'cxo']);
  const PRICE = '$1,800';
  const PEOPLE = {
    kn: { unit: 'CEO office', since: 'Jan 2024', status: 'active', cv: { opt: true, raters: 6, scores: [3.9, 4.3, 3.6, 3.4, 4.1], self: [4.2, 4.5, 4.0, 3.8, 4.0] } },
    oh: { unit: 'Finance', since: 'Mar 2022', status: 'active', share: 'domains', pos: [48, 80, 36, 52, 30], cv: { opt: true, raters: 5, shared: true, scores: [4.2, 3.8, 3.1, 3.6, 4.4] } },
    ib: { unit: 'Operations', since: 'Aug 2023', status: 'active', share: 'facets', pos: [58, 66, 62, 70, 44], facets: [62, 72, 66, 58, 70, 48], cv: { opt: true, raters: 6, scores: [4.0, 4.1, 3.9, 3.7, 3.8] } },
    lj: { unit: 'Product', since: 'Feb 2025', status: 'active', cv: { opt: true, raters: 5, scores: [3.5, 3.2, 4.1, 4.0, 3.3], self: [3.8, 3.5, 3.9, 4.2, 3.6] } },
    sl: { unit: 'People', since: 'Jun 2021', status: 'active', share: 'domains', pos: [70, 60, 74, 78, 38], cv: { opt: false } },
    ed: { unit: 'Sales', since: 'Nov 2024', status: 'active', share: 'nothing', cv: { opt: true, raters: 3, scores: [] } },
    ms: { unit: 'Marketing', since: 'Apr 2026', status: 'active', share: 'nothing', cv: { opt: false } },
    hb: { unit: 'Technology', since: 'Invited 1 Oct', status: 'invited', share: 'nothing', cv: { opt: false } }
  };
  const CONTRIB = ['Preparation', 'Whole-organisation view', 'Information sharing', 'Dialogue', 'Follow-through'];
  const TLF = [['Sets a clear direction for the team', 4.1, 4.4], ['Keeps us on the tasks only we can do', 3.6, 4.0], ['Invites input before deciding', 3.3, 4.1], ['Handles tension early', 3.2, 3.6], ['Follows up on decisions', 4.0, 3.9], ['Shares information openly', 3.8, 4.2], ['Gives every member a voice', 3.4, 4.0], ['Develops each of us', 3.5, 3.5], ['Represents the team well outside', 4.3, 4.0], ['Asks how she can lead better', 3.1, 3.8]];
  const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const PULSES = [[1, '6 Apr', 7], [2, '4 May', 8], [3, '1 Jun', 6], [4, '29 Jun', 3], [5, '27 Jul', 7]];
  const NEXTP = { 2: '19 Oct', 3: '26 Oct', 4: '2 Nov', 5: '9 Nov', 6: '16 Nov', 7: '23 Nov', 8: '30 Nov' };
  const ROTATING = ['Disagreements here stay about the issue, not the person.', 'We share information with each other without being asked.'];
  const PROMPTQ = ['Which ideas does the group drop too early?', 'Where would more structure help, and where would it slow us down?', 'Who needs more room to speak first?', 'Where do we agree too quickly?', 'How do we notice when pressure builds?'];

  const PHASES = [['scheduled', 'Scheduled', 'Dates, participants and reminders are set. Members get a notice 7 days ahead.'], ['open', 'Answering', 'Members answer by link. Only counts are shown, never names.'], ['closed', 'Closed', 'Closes after the window or at 100%. Under 4 answers it is extended once by 7 days.'], ['released', 'Released', 'Everyone gets the results at the same moment.'], ['session', 'Results session', 'The group reads the results together and picks up to 2 focus areas.'], ['followup', 'Follow-up', 'Actions with owners. Pulses track the focus areas.']];
  const PH_IDS = PHASES.map(p => p[0]);
  const PHN = { scheduled: 'Scheduled', open: 'Answering', closed: 'Closed', released: 'Released', session: 'Results session', followup: 'Follow-up', missed: 'No result' };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtD = d => d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  const WDATES = ['12 Oct 2026', '2 Nov 2026', '11 Jan 2027', '1 Mar 2027'];
  const OPENQ = ['What should this team keep doing?', 'What one change would most improve how this team works?'];
  const OUTSIDE = ['This team gives a clear direction to the rest of the company.', 'Decisions from this team are explained clearly.', 'Members of this team speak with one voice.', 'This team keeps its commitments to us.', 'This team asks for our input before deciding.', 'I trust the decisions this team makes.'];
  const OPEN_THEMES = [['What should this team keep doing?', [['Clear strategic direction', 5], ['Honest discussion of priorities', 4], ['Backing each other under pressure', 3]]], ['What one change would most improve how this team works?', [['Shorter, more focused meetings', 6], ['Decide faster and stick to it', 4], ['Share information between units earlier', 3]]]];
  const CVI = [['Comes to meetings prepared.', 0], ['Reads the pre-reads before the meeting.', 0], ['Argues from what is best for the whole company.', 1], ['Puts the company ahead of their own unit when it matters.', 1], ['Shares information others need without being asked.', 2], ['Listens and builds on what others say.', 3], ['Raises disagreement openly in the room.', 3], ['Does what they committed to, on time.', 4]];
  const ACC = ['Very inaccurate', 'Moderately inaccurate', 'Neither', 'Moderately accurate', 'Very accurate'];
  const LPQ = [['Am the life of the party.', 2, 0], ["Sympathize with others' feelings.", 3, 0], ['Get chores done right away.', 1, 0], ['Have frequent mood swings.', 4, 0], ['Have a vivid imagination.', 0, 0], ["Don't talk a lot.", 2, 1], ["Am not interested in other people's problems.", 3, 1], ['Often forget to put things back in their proper place.', 1, 1], ['Am relaxed most of the time.', 4, 1], ['Am not interested in abstract ideas.', 0, 1], ['Talk to a lot of different people at parties.', 2, 0], ["Feel others' emotions.", 3, 0], ['Like order.', 1, 0], ['Get upset easily.', 4, 0], ['Have difficulty understanding abstract ideas.', 0, 1], ['Keep in the background.', 2, 1], ['Am not really interested in others.', 3, 1], ['Make a mess of things.', 1, 1], ['Seldom feel blue.', 4, 1], ['Do not have a good imagination.', 0, 1]];
  const LPF = [['Love to daydream.', 'Imagination', 0], ['Believe in the importance of art.', 'Artistic interests', 0], ['Experience my emotions intensely.', 'Emotionality', 0], ['Prefer variety to routine.', 'Adventurousness', 0], ['Love to read challenging material.', 'Intellect', 0], ['Like to question accepted ways of doing things.', 'Liberalism', 0], ['Complete tasks successfully.', 'Self-efficacy', 1], ['Like to tidy up.', 'Orderliness', 1], ['Keep my promises.', 'Dutifulness', 1], ['Work hard.', 'Achievement-striving', 1], ['Carry out my plans.', 'Self-discipline', 1], ['Choose my words with care.', 'Cautiousness', 1], ['Make friends easily.', 'Friendliness', 2], ['Enjoy being part of a group.', 'Gregariousness', 2], ['Take charge.', 'Assertiveness', 2], ['Am always busy.', 'Activity level', 2], ['Love excitement.', 'Excitement-seeking', 2], ['Radiate joy.', 'Cheerfulness', 2], ['Trust others.', 'Trust', 3], ['Stick to the rules.', 'Morality', 3], ['Make people feel welcome.', 'Altruism', 3], ['Am easy to satisfy.', 'Cooperation', 3], ['Dislike being the center of attention.', 'Modesty', 3], ['Feel sympathy for those who are worse off than myself.', 'Sympathy', 3], ['Worry about things.', 'Anxiety', 4], ['Get angry easily.', 'Anger', 4], ['Often feel blue.', 'Depression', 4], ['Find it difficult to approach others.', 'Self-consciousness', 4], ['Often eat too much.', 'Immoderation', 4], ['Panic easily.', 'Vulnerability', 4]];
  const LAYER_SUB = { conditions: 'How the team is set up: purpose, tasks, people and support.', processes: 'How the team works, in and between meetings.', states: 'How it feels to be part of the team.', outcomes: 'What the team achieves together.' };
  const CAT = [
    { id: 'scan', name: 'Team Scan', kind: 'Group', level: 'Free', items: 12, min: 3, icon: 'lucide:radar', who: 'Every member, no account', freq: 'Any time', output: 'Level and agreement on 6 themes', anon: 'Team view opens at 4 answers', purpose: 'A quick first reading of how the team works.' },
    { id: 'std', name: 'Standard diagnostic', kind: 'Group', level: 'Standard', items: 48, min: 8, icon: 'lucide:clipboard-list', who: 'Every member', freq: 'Every 6 months, between extensive rounds', output: '24 scales: level, change, agreement and item means', anon: 'Results at 4 answers', purpose: 'The core reading of all 24 scales, 2 items per scale.' },
    { id: 'ext', name: 'Extensive diagnostic', kind: 'Group', level: 'Extensive', items: 74, min: 15, icon: 'lucide:clipboard-check', who: 'Every member, plus up to 8 outside raters', freq: 'Once a year', output: 'Everything in standard, plus answer distributions, open-question themes and the outside view', anon: 'Results at 4 answers · outside view at 3', purpose: 'The complete reading: 3 items per scale, open questions and the outside view.' },
    { id: 'pulse', name: 'Pulse', kind: 'Group', level: 'Follow-up', items: 10, min: 2, icon: 'lucide:activity', who: 'Every member', freq: 'Every 2 to 8 weeks', output: 'Trend on focus areas and working agreements', anon: 'Result at 4 answers', purpose: 'A short check on focus areas and agreements between diagnostics.' },
    { id: 'tlf', name: 'Team-leader feedback', kind: 'Individual', level: 'Standard', items: 10, min: 4, icon: 'lucide:message-square', who: 'Members rate the leader, who also rates herself', freq: 'Once or twice a year', output: 'Average per item next to the self-rating', anon: '4 raters besides the leader · she sees it first', purpose: 'Feedback to the team leader on how she leads this group.' },
    { id: 'cv', name: 'Contribution view', kind: 'Individual', level: 'Standard', items: 8, min: 2, icon: 'lucide:handshake', who: 'Colleagues rate each opted-in member', freq: 'Ongoing while turned on', output: 'Average per theme next to the self-rating', anon: '4 raters per person · result to that person only', purpose: 'Feedback to each opted-in member on how they contribute to the team.' },
    { id: 'lpq', name: 'Leader Profile · quick', kind: 'Individual', level: 'Standard', items: 20, min: 4, icon: 'lucide:user-round', who: 'You', freq: 'Any time', output: '5 domains as lower, middle or higher', anon: 'Private by default', purpose: 'A short Big Five profile for your own development (Mini-IPIP).' },
    { id: 'lpf', name: 'Leader Profile · full', kind: 'Individual', level: 'Extensive', items: 120, min: 20, icon: 'lucide:user-round-check', who: 'You', freq: 'Any time', output: '5 domains and 30 facets', anon: 'Private by default', purpose: 'The complete Big Five profile with 30 facets (IPIP-NEO-120).' }
  ];
  CAT.push({ id: 'checkin', name: 'Meeting check-in', kind: 'Group', level: 'Follow-up', items: 17, min: 1, icon: 'lucide:message-circle-question', who: 'Meeting participants', freq: 'After each meeting, open 24 hours', output: 'Goal clarity, focus and outcome per item, dialogue overall', anon: 'Results at 4 answers, otherwise pooled over 3 meetings', purpose: 'A one-minute check on how the meeting worked, item by item.' });
  CAT.push({ id: 'c360', name: 'CXO 360', kind: 'Individual', level: 'Extensive', items: 34, min: 12, icon: 'lucide:radar', who: 'Self, manager or board, peers, direct reports and others', freq: 'Once a year per leader', output: '8 leadership dimensions by rater group, blind spots, hidden strengths and comment themes', anon: '3 raters per group or pooled · manager shown by role · the leader sees it first', purpose: 'Feedback to one executive from everyone who works with them, for their own development.' });
  const CATM = {}; CAT.forEach(c => CATM[c.id] = c);
  const IND_PHASES = {
    scan: [['Answer', '12 items, one per screen, no account.'], ['Personal view', 'Your own reading right away.'], ['Invite', 'One link for the group. Counts only, never names.'], ['Team view', 'Opens for everyone at 4 answers.']],
    pulse: [['Compose', 'Focus-area scales first, then working agreements, then rotating items. At most 10.'], ['Open', 'Opens on the pulse rhythm for the set window.'], ['Remind', 'Only people who have not answered.'], ['Result', 'At 4 answers. Under 4 is logged as missed.'], ['Trend', 'Change shows only at 0.3 points or more.']],
    tlf: [['Open', 'The leader opens a 14-day round.'], ['Rate', 'Members rate 10 items. The leader rates herself on the same items.'], ['Threshold', 'Averages show only at 4 raters besides the leader.'], ['Leader first', 'The leader sees the averages and the gaps to her self-rating.'], ['Share', 'The leader chooses whether to share the averages.'], ['One change', 'The leader picks one thing to change and tells the group.']],
    cv: [['Turn on', 'The group turns the contribution view on.'], ['Opt in', 'Each person decides whether to be rated.'], ['Rate', 'Colleagues rate each opted-in person on 8 items.'], ['Threshold', 'Averages show only at 4 raters per person.'], ['Private result', 'Only the rated person sees it, next to a self-rating.'], ['Share', 'The person chooses what, if anything, to share.']],
    lpq: [['Consent', 'You take it for your own development.'], ['Answer', '20 items. Progress saves if you stop.'], ['Result', '5 domains as lower, middle or higher. Private.'], ['Share', 'Nothing, domains, or domains and facets.'], ['Team map', 'Opens when 3 members share.']],
    lpf: [['Consent', 'You take it for your own development.'], ['Answer', '120 items in 5 parts. Progress saves if you stop.'], ['Result', '5 domains and 30 facets. Private.'], ['Share', 'Nothing, domains, or domains and facets.'], ['Team map', 'Opens when 3 members share.']]
  };
  IND_PHASES.checkin = [['Close', 'The meeting closes in the live view.'], ['Answer', '3 questions on the 5 longest items, 2 on the meeting. Under a minute.'], ['Threshold', 'Results at 4 answers, otherwise pooled over the last 3 meetings.'], ['Trend', 'Shows in the meeting audit, item type by item type.']];
  IND_PHASES.c360 = [['Start', 'The leader starts their own 360. Nobody can start it for them.'], ['Choose raters', 'Manager or board, peers, direct reports and others. At least 3 per anonymous group.'], ['Self-rating', 'The leader rates themselves on the same 32 items.'], ['Collect', 'Raters answer within 14 days. Reminders go only to people who have not answered.'], ['Report', 'The leader sees the report first: groups below 3 are pooled, the manager is shown by role.'], ['Develop', 'The leader picks what to keep and what to grow, and chooses what to share.']];
  function pulseComp(s) { const PC = s.pcfg; const c = []; s.focus.forEach(id => (ITEMS[id] || []).forEach(t => c.push({ text: t, tag: 'Focus · ' + SC[id].label }))); if (PC.agreements) s.charter.agreements.forEach(a => c.push({ text: 'In the last ' + PC.weeks + ' weeks we kept to this: ' + a, tag: 'Working agreement' })); ROTATING.slice(0, PC.rotating).forEach(t => c.push({ text: t, tag: 'Rotating' })); return c.slice(0, 10); }
  function buildRun(s, id, target, lib) {
    const lc = t => t.charAt(0).toLowerCase() + t.slice(1);
    const priv = ['Private by default. You choose what to share.', 'Scores show as lower, middle or higher, never good or bad.', 'Development only. Never used for selection or evaluation.'];
    if (id === 'std' || id === 'ext') {
      const n = id === 'std' ? 2 : 3;
      const secs = LAYERS.map(([lid, ll]) => ({ title: ll, sub: LAYER_SUB[lid], items: [].concat.apply([], SCALES.filter(x => x.layer === lid).map(x => (ITEMS[x.id] || []).slice(0, n).map(t => ({ text: t, tag: lib ? x.label : '' })))) }));
      if (id === 'ext') secs.push({ title: 'Open questions', sub: 'Optional. Reported only as themes, never word for word.', items: OPENQ.map(t => ({ text: t, tag: lib ? 'Open question' : '', open: true })) });
      if (id === 'ext' && lib) secs.push({ title: 'Outside raters', sub: 'Answered by up to 8 people outside the group. Organisation plan.', items: OUTSIDE.map(t => ({ text: t, tag: 'Outside view' })) });
      return { secs, opts: OPTS, lead: 'How much do you agree?', privacy: ['No name is stored with your answers.', 'Results show only when 4 or more have answered.', 'Everyone gets the results at the same moment.'] };
    }
    if (id === 'pulse') return { secs: [{ title: 'Pulse 6', sub: 'Focus areas first, then working agreements.', items: pulseComp(s).map(x => ({ text: x.text, tag: lib ? x.tag : '' })) }], opts: OPTS, lead: 'How much do you agree?', privacy: ['Anonymous. Result at 4 answers.', 'Only the trend is shown, never single answers.'] };
    if (id === 'tlf') { const self = !lib && s.role === 'leader'; return { secs: [{ title: self ? 'Rate yourself' : 'Rate Kari', sub: self ? 'Your self-rating shows as a tick next to the group average.' : 'Think about the last 3 months.', items: TLF.map(r => ({ text: self ? r[0].replace(/^(\w+?)s /, '$1 ').replace('she', 'I') + '.' : 'Kari ' + lc(r[0]) + '.', tag: lib ? 'Team leadership' : '' })) }], opts: OPTS, lead: self ? 'How well does this describe you?' : 'How much do you agree?', privacy: self ? ['Only you see your self-rating next to the averages.'] : ['Anonymous. Kari sees averages only, at 4 raters or more.', 'No comments and no names.'] }; }
    if (id === 'cv') { const m = s.members.find(x => x.id === target); const who = m ? m.name.split(' ')[0] : 'Your colleague'; return { secs: CONTRIB.map((th, k) => ({ title: th, sub: '', items: CVI.filter(c => c[1] === k).map(c => ({ text: who + ' ' + lc(c[0]), tag: lib ? th : '' })) })), opts: OPTS, lead: 'How much do you agree?', privacy: ['Only ' + who + ' sees the averages, at 4 raters or more.', 'No ranking and no names.'] }; }
    if (id === 'lpq') { const mk = q => ({ text: q[0], tag: lib ? DOMAINS[q[1]] + (q[2] ? ' · reverse-scored' : '') : '', d: q[1], r: q[2] }); return { secs: [{ title: 'Part 1', sub: 'Describe yourself as you generally are now.', items: LPQ.slice(0, 10).map(mk) }, { title: 'Part 2', sub: 'Describe yourself as you generally are now.', items: LPQ.slice(10).map(mk) }], opts: ACC, lead: 'How accurately does this describe you?', privacy: priv }; }
    if (id === 'lpf') return { secs: DOMAINS.map((dn, d) => ({ title: dn, sub: 'One sample item per facet in this prototype. The live test has 4 per facet.', items: LPF.filter(q => q[2] === d).map(q => ({ text: q[0], tag: lib ? q[1] : '', d: q[2], r: 0 })) })), opts: ACC, lead: 'How accurately does this describe you?', privacy: priv };
    if (id === 'checkin') { const top = s.agenda.slice().sort((a, b) => b.minutes - a.minutes).slice(0, 5); const secs = top.map(it => ({ title: it.title, sub: it.type + ' · ' + it.minutes + ' min', items: ['The goal of this item was clear.', 'We stayed on the item.', 'We reached the desired outcome.'].map(t => ({ text: t, tag: lib ? it.type : '' })) })); secs.push({ title: 'The meeting as a whole', sub: '', items: [{ text: 'Everyone could say what they thought.', tag: lib ? 'Dialogue' : '' }, { text: 'The meeting was worth the time it took.', tag: lib ? 'Overall' : '' }] }); return { secs, opts: OPTS, lead: 'How much do you agree?', privacy: ['Anonymous. Results show at 4 answers.', 'Below 4, answers pool over the last 3 meetings.'] }; }
    if (id === 'c360') { const tm = s.members.find(x => x.id === target); const self = !lib && target && s.role !== 'coach' && target === (s.role === 'member' ? 'lj' : 'kn'); const who = tm ? tm.name.split(' ')[0] : 'This leader'; const lc = t => t.charAt(0).toLowerCase() + t.slice(1); const secs = C360.map(([cid, cl, its]) => ({ title: cl, sub: '', items: its.map(t => ({ text: self ? t : who + ' ' + lc(t), tag: lib ? cl : '' })) })); secs.push({ title: 'Open questions', sub: 'Optional. Shown to the leader only as themes, never word for word.', items: C360_OPEN.map(t => ({ text: t, tag: lib ? 'Open question' : '', open: true })) }); return { secs, opts: OPTS, lead: self ? 'How well does this describe you?' : 'How much do you agree?', privacy: self ? ['Your self-rating shows next to how others see you.'] : ['Anonymous within your rater group. Groups below 3 are pooled.', 'Only ' + who + ' sees the report, and chooses what to share.', 'Development only. Never used for pay, promotion or selection.'] }; }
    return { secs: [], opts: OPTS, lead: '', privacy: [] };
  }
  function flatOf(s, R) { const out = []; buildRun(s, R.id, R.target).secs.forEach((sec, si) => sec.items.forEach(it => out.push(Object.assign({ si }, it)))); return out; }
  function isPreview(s, R) {
    if (s.role === 'coach') return true;
    if (['std', 'ext', 'pulse', 'tlf', 'cv'].includes(R.id) && s.plan === 'free') return true;
    if (R.id === 'std' || R.id === 'ext') return !s.rounds.some(x => x.type === R.id && x.status === 'open' && !x.mine);
    if (R.id === 'pulse') return !!s.pulseMine;
    if (R.id === 'tlf') return s.tlf.status !== 'open' || (s.role === 'member' ? s.tlf.ratedMember : !!s.tlf.selfDone);
    if (R.id === 'cv') return !R.target || s.cvRated.includes(R.target);
    if (R.id === 'checkin') return !s.live.ended || !!s.mtg.ci.mine;
    if (R.id === 'c360') { if (!R.target) return true; const mine = R.target === (s.role === 'member' ? 'lj' : 'kn'); const P = s.c360.people[R.target]; return mine ? !P || P.selfDone || P.status === 'report' || P.status === 'none' : s.c360.rated.includes(R.target) || !P || P.status !== 'collecting'; }
    return false;
  }
  const C360 = [
    ['strategy', 'Strategic direction', ['Sets a clear direction for their area that fits the company strategy.', 'Makes clear priorities and says no to work that does not fit them.', 'Explains the reasons behind important decisions.', 'Thinks beyond this year when making choices.']],
    ['enterprise', 'Enterprise leadership', ['Acts in the interest of the whole company, not only their own unit.', 'Shares information other units need without being asked.', 'Gives up resources when another area needs them more.', 'Builds working relationships across the company.']],
    ['execution', 'Execution and accountability', ['Delivers on commitments on time.', 'Sets clear expectations for their people.', 'Follows up on decisions until they are done.', 'Makes decisions in time, also with incomplete information.']],
    ['people', 'Leading people', ['Gives regular, useful feedback.', 'Develops the people who report to them.', 'Delegates real responsibility.', 'Builds a team that works well without them.']],
    ['team', 'Contribution to the leadership team', ['Comes to leadership meetings prepared.', 'Challenges ideas openly in the room, not after it.', 'Supports team decisions once made, also after disagreeing.', 'Listens and builds on what others say.']],
    ['stake', 'Stakeholders and customers', ['Keeps key stakeholders informed and involved.', 'Brings the customer view into decisions.', 'Represents the company well outside it.', 'Handles owners and the board with confidence.']],
    ['change', 'Change and learning', ['Asks for feedback on their own leadership.', 'Changes course when something is not working.', 'Admits mistakes and learns from them.', 'Leads change in a way people can follow.']],
    ['integrity', 'Integrity and trust', ['Keeps their promises.', 'Is honest, also when it is uncomfortable.', 'Treats people fairly.', 'Can be trusted with confidential information.']]
  ];
  const RG = [['mgr', 'Manager or board'], ['peer', 'Peers in the leadership group'], ['dr', 'Direct reports'], ['oth', 'Others']];
  const C360_OPEN = ['What should this person keep doing?', 'What one change would make the biggest difference to their leadership?'];
  const C360S = {
    kn: { self: [4.2, 3.8, 4.4, 3.9, 4.0, 4.1, 3.7, 4.5], mgr: [4.3, 3.9, 4.2, 3.6, 4.0, 4.4, 3.5, 4.6], peer: [4.0, 3.2, 4.1, 3.4, 3.6, 4.2, 3.3, 4.3], dr: [4.4, 3.6, 3.9, 3.1, 3.8, 3.9, 3.0, 4.2], oth: [4.1, 3.5, 4.0, 3.5, 3.7, 4.5, 3.4, 4.4],
      themes: [[['Clear strategic direction', 9], ['Calm under pressure', 6], ['Strong with the board', 4]], [['Ask for input before deciding', 7], ['Give more feedback to direct reports', 6], ['Let others lead discussions', 4]]] },
    ib: { self: [3.6, 4.0, 4.3, 3.8, 4.2, 3.4, 3.9, 4.4], mgr: [3.8, 4.2, 4.5, 4.0, 4.3, 3.5, 4.0, 4.6], peer: [3.7, 4.4, 4.4, 3.9, 4.4, 3.3, 4.1, 4.5], dr: [3.9, 4.1, 4.2, 4.3, 4.0, 3.4, 4.2, 4.6], oth: [3.6, 4.3, 4.4, 3.8, 4.1, 3.2, 3.8, 4.4],
      themes: [[['Reliable follow-through', 8], ['Shares information early', 6], ['Fair to everyone', 5]], [['Speak up more on strategy', 6], ['Spend more time with customers', 5], ['Delegate the detail', 3]]] }
  };
  C360S._def = { self: [3.9, 3.6, 3.8, 3.7, 4.1, 3.5, 3.8, 4.2], mgr: [3.8, 3.7, 3.6, 3.4, 4.0, 3.6, 3.5, 4.3], peer: [3.6, 3.3, 3.7, 3.5, 3.8, 3.4, 3.6, 4.1], dr: [3.9, 3.5, 3.5, 3.8, 3.7, 3.3, 3.7, 4.2], oth: [3.7, 3.4, 3.6, 3.5, 3.7, 3.8, 3.4, 4.0], themes: [[['Energy in discussions', 6], ['Product knowledge', 5]], [['Prepare more for meetings', 5], ['Listen before arguing', 4]]] };
  const C360_OFF = [0.15, -0.05, 0.1, -0.2];
  const PURP = [['info', 'Information exchange', 10, 35], ['coord', 'Coordination across units', 20, 25], ['dec', 'Decisions', 20, 15], ['advice', 'Advice and sparring', 10, 8], ['strat', 'Strategy and direction', 25, 7], ['dev', 'Developing the leaders', 10, 5], ['amb', 'Representing the company', 5, 5]];
  const PURPL = {}; PURP.forEach(p => PURPL[p[0]] = p[1]);
  const YEAR = [['Oct', '2026', ['Budget 2027, first draft']], ['Nov', '2026', ['Budget 2027 decision', 'Team tasks workshop']], ['Dec', '2026', ['Reflection session', 'Development day']], ['Jan', '2027', ['Strategy kick-off']], ['Feb', '2027', []], ['Mar', '2027', ['Round 3 diagnostic', 'Reflection session', 'Development day']], ['Apr', '2027', ['Strategy review']], ['May', '2027', []], ['Jun', '2027', ['Talent review', 'Reflection session', 'Development day']], ['Jul', '2027', []], ['Aug', '2027', ['Strategy offsite']], ['Sep', '2027', ['Round 4 diagnostic', 'Reflection session']]];
  const DEC_LOG = [['24 Sep', 'Weekly', 'Freeze hiring in sales until Q4 numbers are in', 'ed'], ['17 Sep', 'Weekly', 'Move the product launch to 12 November', 'lj'], ['8 Sep', 'Strategy', 'Enter the Swedish SMB market in 2027', 'kn'], ['3 Sep', 'Weekly', 'Approve the new travel policy', 'oh'], ['27 Aug', 'Weekly', 'Pilot a four-day support rota in Operations', 'ib']];
  const chg2 = d => Math.abs(d) < 0.29 ? 'Stable' : (d > 0 ? '+' : '−') + (Math.round(Math.abs(d) * 10) / 10).toFixed(1);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const fmt = n => (Math.round(n * 10) / 10).toFixed(1);
  const pct = v => ((Math.max(1, Math.min(5, v)) - 1) / 4 * 100).toFixed(1) + '%';
  const hpct = v => (Math.max(0, Math.min(1, (v - 2) / 3)) * 100).toFixed(1) + '%';
  const clamp = v => Math.max(1, Math.min(5, v));
  const band = p => p < 33.4 ? 'Lower' : p < 66.7 ? 'Middle' : 'Higher';
  const rel = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'Just now' : m + ' min ago'; };
  const mmss = s => { s = Math.max(0, s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const validEmail = e => /.+@.+\..+/.test(e || '');
  function dist(m, ag) {
    const sd = ag === 'high' ? 0.6 : ag === 'medium' ? 0.9 : 1.3;
    const w = [1, 2, 3, 4, 5].map(k => Math.exp(-((k - m) ** 2) / (2 * sd * sd)));
    const tot = w.reduce((a, b) => a + b, 0);
    const raw = w.map(x => x / tot * 8);
    const fl = raw.map(Math.floor);
    const rem = 8 - fl.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0]).slice(0, rem).forEach(p => fl[p[1]]++);
    return fl;
  }
  function series(id) {
    if (id === 'meetingGoals') return [2.8, 2.9, 3.0, 3.0, 3.2, 3.2, 3.3];
    const sc = SC[id]; if (!sc) return [3, 3, 3, 3, 3, 3, 3];
    return [0, 1, 2, 3, 4, 5, 6].map(i => Math.round((sc.r1 + (sc.r2 - sc.r1) * i / 6) * 10) / 10);
  }
  function guide(sc) {
    if (sc.ag === 'low') return 'Your views differ on this. Talk about the difference before choosing a fix.';
    if (sc.read === 'descriptive') return 'Shown as a fact. The evidence on this is mixed, so there is no flag and no target.';
    if (sc.read === 'conditional') return 'Read together with relationship conflict. Open disagreement about the work helps while relationship conflict stays low.';
    if (sc.read === 'lower') return sc.r2 >= 4 ? 'This is high. Strong evidence says to deal with it before other work.' : 'Lower is better, and your level is low. Keep watching it at each pulse.';
    if (sc.layer === 'outcomes') return 'Outcomes are self-rated. The outside view adds an independent check.';
    const low = sc.r2 < 3.2;
    if (sc.ev === 'Strong') return low ? 'Strong evidence links this to team results. Treat it as a priority.' : 'Strong evidence links this to team results. Keep doing what works.';
    if (sc.ev === 'Not yet rated') return 'Not yet rated. Treated as moderate until reviewed. ' + (low ? 'Working on it is likely to help.' : 'No action needed now.');
    return low ? 'Working on this is likely to help. See the linked practice.' : 'At a workable level. Working on it is likely to help further.';
  }
  function itemState(s, it) {
    const missing = [];
    if (!it.type) missing.push('type');
    if (!it.outcome || !it.outcome.trim()) missing.push('outcome');
    if (!it.owner) missing.push('owner');
    if (it.pre === 'needed' || it.pre === 'late') missing.push('pre-read');
    const complete = missing.length === 0;
    const flagged = s.charter.tasks.length > 0 && !it.task && !it.ok;
    return { complete, flagged, ready: complete && !flagged, missing };
  }

  function initial() {
    return {
      v: VERSION, route: 'landing', role: 'leader', plan: 'free', protoOpen: false,
      scan: { idx: 0, answers: Array(12).fill(null) },
      save: { email: '', groupName: 'Lumio leadership group', size: 8, saved: false },
      invite: { answered: 1, copied: false },
      upgradeOpen: false,
      charter: {
        version: 3,
        purpose: "We set Lumio's direction, decide what only this group can decide, and make sure the four units pull the same way.",
        tasks: [
          { id: 't1', title: 'Set strategy and yearly priorities', right: 'Decide', owner: 'kn' },
          { id: 't2', title: 'Approve budgets and major investments', right: 'Decide', owner: 'oh' },
          { id: 't3', title: 'Coordinate priorities across the units', right: 'Advise', owner: 'ib' },
          { id: 't4', title: 'Develop the leaders below us', right: 'Decide', owner: 'sl' }
        ],
        agreements: ['We send pre-reads 48 hours before the meeting.', 'Every agenda item states its desired outcome.', 'We disagree in the room, not after it.', 'Decisions get an owner before we move on.']
      },
      draft: null, groupTab: 'charter',
      members: MEMBERS.map(m => Object.assign({}, m)), newMember: '', coachAccess: true,
      res: { round: 2, layer: 'processes', depth: 'standing', scale: 'focus', qLayer: 'all' },
      focus: ['meetingGoals'],
      actions: [
        { id: 'x1', text: 'Add an outcome field to the agenda template', owner: 'ib', due: '7 Oct', done: false },
        { id: 'x2', text: 'Share the Q4 hiring plan pre-read', owner: 'lj', due: '6 Oct', done: false },
        { id: 'x3', text: 'Run a structured round on the decision item', owner: 'kn', due: '8 Oct', done: false },
        { id: 'x4', text: 'Collect private input on purpose', owner: 'sl', due: '2 Oct', done: true }
      ],
      na: { text: '', owner: '', due: '15 Oct' },
      devTab: 'plan', pFilter: 'focus', practices: ['outcomeFirst'], pOpen: 'outcomeFirst',
      agenda: [
        { id: 'a1', title: 'Check-in round', type: 'Information', outcome: 'Everyone has shared one headline from their unit.', owner: 'kn', minutes: 5, task: 't3', ok: false },
        { id: 'a2', title: 'Q3 results', type: 'Information', outcome: 'Everyone knows where Q3 landed against plan.', owner: 'oh', minutes: 15, task: 't2', ok: false },
        { id: 'a3', title: 'Q4 hiring plan for the product unit', type: 'Decision', outcome: 'A yes or no on six new roles, each with a hiring owner.', owner: 'lj', minutes: 20, task: 't2', ok: false },
        { id: 'a4', title: 'SMB pricing change', type: 'Discussion', outcome: '', owner: 'ed', minutes: 25, task: 't1', ok: false },
        { id: 'a5', title: 'Office move', type: 'Information', outcome: 'Everyone knows the move dates.', owner: 'ib', minutes: 10, task: null, ok: false },
        { id: 'a6', title: 'Customer churn follow-up', type: 'Follow-up', outcome: 'Agreed status on the three churn actions.', owner: 'ms', minutes: 15, task: 't3', ok: false },
        { id: 'a7', title: 'Reflection', type: 'Information', outcome: 'One thing to keep and one to change.', owner: 'kn', minutes: 5, task: 't4', ok: false }
      ],
      sel: 'a4', meetTab: 'agenda',
      live: freshLive(7),
      share: { leader: 'domains', member: 'nothing' }, profileDone: { leader: true, member: false },
      modules: { leader: [], member: [] }, consent: null, consentOk: false,
      pulse: { answered: 6, of: 8 },
      rounds: [
        { id: 'r1', type: 'ext', label: 'Round 1', opens: '2 Mar', closes: '16 Mar 2026', status: 'followup', answered: 8, of: 8, mine: true, notice: '23 Feb', released: '18 Mar', session: '20 Mar', follow: '2 focus areas · 4 actions' },
        { id: 'r2', type: 'std', label: 'Round 2', opens: '14 Sep', closes: '28 Sep 2026', status: 'released', answered: 8, of: 8, mine: true, notice: '7 Sep', released: '30 Sep', session: '7 Oct · planned' },
        { id: 'r3', type: 'ext', label: 'Round 3', opens: '1 Mar', closes: '15 Mar 2027', status: 'scheduled', answered: 0, of: 8, mine: false, notice: '22 Feb' },
        { id: 'f2', type: 'tlf', label: 'Feedback round 2', opens: '2 Nov', closes: '16 Nov 2026', status: 'scheduled', answered: 0, of: 7, mine: false, notice: '26 Oct' }
      ],
      wiz: { type: 'std', opens: '12 Oct 2026', window: 14, people: MEMBERS.map(m => m.id) },
      run: null, drafts: {}, pulseMine: false, cvRated: [], lpScores: {}, lpLevel: { leader: 'lpf' }, libSel: 'ext', libSec: 0,
      proj: [
        { id: 'p1', title: 'Every agenda item has a desired outcome', scale: 'meetingGoals', owner: 'ib', start: 0, end: 5, target: '3.6', kpi: 'Items carried over per meeting: 2.4 now, 1 or fewer', status: 'on', ms: [{ t: 'Outcome field added to the agenda template', due: '7 Oct', m: 0, done: true }, { t: 'Outcome-first practice in 4 meetings in a row', due: '4 Nov', m: 1, done: false }, { t: 'Agenda readiness at 90% for a month', due: '2 Dec', m: 2, done: false }, { t: 'Meeting goals at 3.6 or above in round 3', due: '15 Mar', m: 5, done: false }] },
        { id: 'p2', title: 'Keep discussions on the item at hand', scale: 'focus', owner: 'lj', start: 0, end: 4, target: '3.4', kpi: 'Meetings ending on time: 5 of 9 now, 8 of 9', status: 'risk', ms: [{ t: 'Parking lot used in every meeting', due: '14 Oct', m: 0, done: true }, { t: 'Process-comment norm agreed by the group', due: '28 Oct', m: 0, done: false }, { t: 'Focus at 3.2 or above in two pulses', due: '20 Jan', m: 3, done: false }, { t: 'Review in the reflection session', due: '10 Feb', m: 4, done: false }] },
        { id: 'p3', title: 'Sharpen team tasks and decision rights', scale: 'teamTasks', owner: 'kn', start: 1, end: 3, target: '3.8', kpi: 'Agenda items matching no team task: 18% now, under 10%', status: 'todo', ms: [{ t: 'Team tasks workshop held', due: '18 Nov', m: 1, done: false }, { t: 'Charter v4 agreed', due: '2 Dec', m: 2, done: false }, { t: 'Agenda audit shows under 10% unmatched items', due: '20 Jan', m: 3, done: false }] }
      ],
      projOpen: 'p1', newMs: {},
      mtg: { series: [
        { id: 'w', name: 'Weekly leadership meeting', when: 'Thursdays 09:00', len: '90 min', purposes: ['coord', 'info', 'dec'], next: 'Thu 8 Oct' },
        { id: 'm', name: 'Monthly strategy meeting', when: 'First Tuesday, 13:00', len: '3 hours', purposes: ['strat', 'dec', 'advice'], next: 'Tue 3 Nov' },
        { id: 'q', name: 'Quarterly development day', when: 'Once a quarter', len: 'Full day', purposes: ['dev', 'advice', 'amb'], next: 'Thu 10 Dec' }
      ], ns: { name: '', purposes: [] }, roles: { chair: 'kn', time: 'ib', notes: 'sl' }, ci: { answered: 0, mine: false }, heard: {}, parked: ['Office canteen supplier', 'Summer party budget'], newPark: '' },
      c360: { tab: 'mine', view: 'kn', rated: [], dev: { keep: [], grow: [] }, people: {
        kn: { status: 'report', selfDone: true, shared: false, raters: { mgr: { n: 1, of: 1 }, peer: { n: 6, of: 7 }, dr: { n: 5, of: 6 }, oth: { n: 2, of: 4 } } },
        lj: { status: 'nominate', selfDone: false, shared: false, raters: { mgr: { n: 0, of: 1 }, peer: { n: 0, of: 7 }, dr: { n: 0, of: 0 }, oth: { n: 0, of: 0 } } },
        oh: { status: 'collecting', selfDone: true, shared: false, raters: { mgr: { n: 1, of: 1 }, peer: { n: 4, of: 7 }, dr: { n: 2, of: 5 }, oth: { n: 0, of: 3 } } },
        ib: { status: 'report', selfDone: true, shared: true, raters: { mgr: { n: 1, of: 1 }, peer: { n: 5, of: 7 }, dr: { n: 4, of: 5 }, oth: { n: 3, of: 3 } } },
        ed: { status: 'collecting', selfDone: false, shared: false, raters: { mgr: { n: 1, of: 1 }, peer: { n: 3, of: 7 }, dr: { n: 4, of: 8 }, oth: { n: 0, of: 0 } } }
      } },
      ui: { nav: 'vertical', wide: false },
      set: { tab: 'account', email: 'kari@lumio.no', lang: 'English', qlang: 'English', tz: 'Europe/Oslo', anon: 4, notif: { roundOpen: true, reminder: true, released: true, actions: true, feedback: true, digest: false } },
      bill: { step: 0, period: 'year', company: 'Lumio AS', org: '923 456 789', email: 'faktura@lumio.no', method: 'invoice', ref: 'Leadership group', down: false, since: '' }, assessTab: 'overview', peopleTab: 'roster', person: 'oh',
      sched: { rhythm: 6, window: 14, reminders: [3, 7, 12], start: 'Mar', release: 'session', r3: 'planned', r3answered: 0 },
      pcfg: { weeks: 4, rotating: 2, agreements: true, windowDays: 5 },
      tlf: { status: 'closed', raters: 6, shared: false, ratedMember: false },
      cv: { group: true, optIn: { leader: true, member: true }, shared: { leader: false, member: false } },
      toast: null
    };
  }
  function freshLive(online) { return { started: false, ended: false, idx: 0, secs: 0, running: false, outcomes: {}, comments: [], decisions: {}, actions: [], online: online || 7, na: '' }; }

  function createStore(key) {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { s = null; }
    if (!s || s.v !== VERSION) s = initial();
    { const d0 = initial(); Object.keys(d0).forEach(k => { if (s[k] === undefined) s[k] = d0[k]; }); }
    s.agenda.forEach(a => { if (a.pre === undefined) a.pre = ({ a2: 'attached', a3: 'attached', a6: 'needed' })[a.id] || 'none'; });
    s.toast = null; s.upgradeOpen = false; s.consent = null;
    const subs = new Set();
    let tt = null;
    const store = { get s() { return s; }, A: null, subscribe(f) { subs.add(f); return () => subs.delete(f); } };
    const commit = () => { try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) {} subs.forEach(f => f()); };
    const toast = t => { s.toast = t; commit(); clearTimeout(tt); tt = setTimeout(() => { s.toast = null; commit(); }, 3800); };
    const top = () => { try { window.scrollTo(0, 0); } catch (e) {} };
    const selItem = () => s.agenda.find(x => x.id === s.sel);
    const who = () => s.role === 'member' ? 'member' : 'leader';
    const A = {
      set(p) { Object.assign(s, p); commit(); },
      go(route) { if (s.role === 'coach' && (route === 'home' || route === 'me' || route === 'people' || route === 'cxo')) route = 'group'; s.route = route; commit(); top(); },
      setRole(role) { s.role = role; if (role === 'coach' && (s.route === 'home' || s.route === 'me' || s.route === 'people' || s.route === 'cxo')) s.route = 'group'; commit(); toast('Viewing as ' + ME[role].name + ', ' + ME[role].title.toLowerCase()); },
      setPlan(plan) { s.plan = plan; commit(); toast(plan === 'team' ? 'Team plan on' : 'Free plan on'); },
      reset() { s = initial(); commit(); top(); },
      jump(id) {
        if (id === 'standing') { s.route = 'results'; s.res.depth = 'standing'; commit(); top(); return; }
        if (id === 'plan') { s.route = 'develop'; s.devTab = 'plan'; commit(); top(); return; }
        if (['series', 'checkin', 'log', 'audit'].includes(id)) { s.route = 'meetings'; s.meetTab = id; commit(); top(); return; }
        if (id === 'c360') { A.go('cxo'); return; }
        if (id === 'person') { if (s.role === 'coach') { A.go('group'); return; } s.route = 'people'; s.peopleTab = 'person'; commit(); top(); return; }
        if (['overview', 'library', 'schedule', 'pulse', 'tests'].includes(id)) { s.route = 'assess'; s.assessTab = id; commit(); top(); return; }
        if (['personal', 'invite', 'team'].includes(id) && s.scan.answers.some(a => a == null)) { s.scan.answers = [4, 4, 3, 2, 3, 4, 4, 3, 4, 4, 4, 3]; s.scan.idx = 11; }
        if (id === 'team' && s.invite.answered < 4) s.invite.answered = 6;
        if (id === 'live' || id === 'agenda') { if (s.role !== 'coach' || true) { s.route = 'meetings'; s.meetTab = id; commit(); top(); } return; }
        A.go(id);
      },
      startScan() { s.route = 'scan'; commit(); top(); },
      answer(k) { s.scan.answers[s.scan.idx] = k; commit(); },
      scanNext() { if (s.scan.answers[s.scan.idx] == null) return; if (s.scan.idx < 11) s.scan.idx++; else s.route = 'personal'; commit(); top(); },
      scanBack() { if (s.scan.idx > 0) { s.scan.idx--; commit(); } },
      setSave(f, v) { s.save[f] = v; commit(); },
      size(d) { s.save.size = Math.max(4, Math.min(15, s.save.size + d)); if (s.invite.answered > s.save.size) s.invite.answered = s.save.size; commit(); },
      saveGroup() { if (!validEmail(s.save.email) || !s.save.groupName.trim()) return; s.save.saved = true; s.route = 'invite'; commit(); top(); toast('Saved. Your group has one invite link.'); },
      submitMember() { s.invite.answered = Math.max(s.invite.answered + 1, 4); s.route = 'invite'; commit(); top(); toast('Your answers are in. Nobody can see who answered.'); },
      copyLink() { s.invite.copied = true; commit(); toast('Invite link copied'); },
      simulate() { if (s.invite.answered >= s.save.size) return; s.invite.answered++; commit(); if (s.invite.answered === 4) toast('4 answers in. The team view is open for everyone.'); },
      openUpgrade() { A.goPlan(); },
      closeUpgrade() { s.upgradeOpen = false; commit(); },
      confirmUpgrade() { s.plan = 'team'; s.upgradeOpen = false; s.route = 'group'; commit(); top(); toast('Team plan active. Your scan results carried over.'); },
      toggleAction(id) { const a = s.actions.find(x => x.id === id); if (a) { a.done = !a.done; commit(); } },
      startEdit() { s.draft = JSON.parse(JSON.stringify({ purpose: s.charter.purpose, tasks: s.charter.tasks, agreements: s.charter.agreements })); commit(); },
      cancelEdit() { s.draft = null; commit(); },
      agree() { const d = s.draft; if (!d) return; s.charter = { version: s.charter.version + 1, purpose: d.purpose, tasks: d.tasks.filter(t => t.title.trim()), agreements: d.agreements.filter(a => a.trim()) }; s.draft = null; commit(); toast('Charter v' + s.charter.version + ' agreed and in force'); },
      draftSet(f, v) { if (s.draft) { s.draft[f] = v; commit(); } },
      draftTask(i, f, v) { if (s.draft && s.draft.tasks[i]) { s.draft.tasks[i][f] = v; commit(); } },
      addTask() { if (!s.draft) return; s.draft.tasks.push({ id: 't' + Date.now(), title: '', right: 'Decide', owner: 'kn' }); commit(); },
      removeTask(i) { if (!s.draft) return; s.draft.tasks.splice(i, 1); commit(); },
      draftAgreement(i, v) { if (!s.draft) return; s.draft.agreements[i] = v; commit(); },
      addAgreement() { if (!s.draft) return; s.draft.agreements.push(''); commit(); },
      removeAgreement(i) { if (!s.draft) return; s.draft.agreements.splice(i, 1); commit(); },
      setNewMember(v) { s.newMember = v; commit(); },
      addMember() {
        const n = s.newMember.trim(); if (n.length < 2) return;
        if (s.members.length >= 15) { toast('A group can have up to 15 members'); return; }
        const ini = n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
        s.members.push({ id: 'm' + Date.now(), name: n, role: 'Member', initials: ini, tone: s.members.length });
        s.newMember = ''; commit(); toast(n + ' added. They get an email invitation.');
      },
      removeMember(id) { const m = s.members.find(x => x.id === id); if (!m || m.leader) return; s.members = s.members.filter(x => x.id !== id); commit(); toast(m.name + ' removed. Past rounds stay intact.'); },
      toggleCoach() { s.coachAccess = !s.coachAccess; commit(); toast(s.coachAccess ? 'Anne Vik can see group-level results again' : 'Coach access withdrawn. It applies on her next request.'); },
      setRes(p) { Object.assign(s.res, p); commit(); },
      openScale(id) { s.route = 'results'; s.res.scale = id; s.res.depth = 'scale'; if (SC[id] && SC[id].layer !== 'outcomes') s.res.layer = SC[id].layer; commit(); top(); },
      openRound() { toast('Round 3 is planned for March 2027, with a 14-day window.'); },
      addFocus(id) {
        if (s.focus.includes(id)) return;
        if (s.focus.length >= 2) { toast('Close a focus area first. Two can be active.'); return; }
        s.focus.push(id); commit(); toast(SC[id].label + ' is now a focus area');
      },
      removeFocus(id) { s.focus = s.focus.filter(x => x !== id); commit(); toast('Focus area closed'); },
      setNa(f, v) { s.na[f] = v; commit(); },
      saveAction() {
        if (!s.na.text.trim()) return;
        if (!s.na.owner) { toast('An action needs an owner'); return; }
        s.actions.unshift({ id: 'x' + Date.now(), text: s.na.text.trim(), owner: s.na.owner, due: s.na.due || '15 Oct', done: false });
        s.na = { text: '', owner: '', due: '15 Oct' }; commit(); toast('Action saved. It shows on Home until it is done.');
      },
      togglePractice(id) { const on = s.practices.includes(id); s.practices = on ? s.practices.filter(x => x !== id) : s.practices.concat(id); commit(); toast(on ? 'Practice removed from meetings' : 'Practice added. It shows on Home as a reminder.'); },
      openPractice(id) { s.route = 'develop'; s.devTab = 'practices'; s.pFilter = 'all'; s.pOpen = id; commit(); top(); },
      selectItem(id) { s.sel = id; commit(); },
      upd(f, v) { const it = selItem(); if (!it) return; it[f] = v; if (f === 'task') it.ok = false; commit(); },
      minutes(d) { const it = selItem(); if (!it) return; it.minutes = Math.max(5, Math.min(90, it.minutes + d)); commit(); },
      addItem() { const id = 'a' + Date.now(); s.agenda.push({ id, title: 'New item', type: '', outcome: '', owner: s.role === 'coach' ? '' : ME[s.role].id, minutes: 10, task: null, ok: false }); s.sel = id; commit(); toast('Item proposed. Add a type and an outcome to make it ready.'); },
      removeItem() { s.agenda = s.agenda.filter(x => x.id !== s.sel); s.sel = s.agenda[0] ? s.agenda[0].id : null; commit(); },
      confirmItem() { const it = selItem(); if (!it) return; it.ok = true; commit(); toast('Kept on the agenda'); },
      startMeeting() { if (!s.agenda.length) return; const on = s.live.online; s.live = freshLive(on); s.live.started = true; s.live.running = true; s.live.secs = s.agenda[0].minutes * 60; s.route = 'meetings'; s.meetTab = 'live'; commit(); top(); },
      toggleRun() { s.live.running = !s.live.running; commit(); },
      plus5() { s.live.secs += 300; commit(); },
      comment(t) { if (s.live.online < 4) return; s.live.comments.unshift({ text: t, item: s.live.idx + 1, t: Date.now() }); commit(); toast('Shown to everyone, without a name'); },
      online(d) { s.live.online = Math.max(1, Math.min(s.members.length, s.live.online + d)); commit(); },
      setDecision(v) { const it = s.agenda[s.live.idx]; if (!it) return; s.live.decisions[it.id] = v; commit(); },
      setLiveNa(v) { s.live.na = v; commit(); },
      addLiveAction() {
        const it = s.agenda[s.live.idx]; const t = (s.live.na || '').trim(); if (!it || !t) return;
        s.live.actions.push({ item: it.id, text: t, owner: it.owner || 'kn', due: '15 Oct' });
        s.actions.unshift({ id: 'x' + Date.now(), text: t, owner: it.owner || 'kn', due: '15 Oct', done: false });
        s.live.na = ''; commit(); toast('Action saved with an owner and a date');
      },
      closeItem(o) {
        const L = s.live; const it = s.agenda[L.idx]; if (!it) return;
        L.outcomes[it.id] = o;
        if (L.idx < s.agenda.length - 1) { L.idx++; L.secs = s.agenda[L.idx].minutes * 60; L.running = true; } else { L.ended = true; L.running = false; }
        commit();
      },
      endMeeting() { s.live.ended = true; s.live.running = false; commit(); toast('Meeting closed. The check-in is open for 24 hours.'); },
      resetMeeting() { s.live = freshLive(s.live.online); commit(); },
      setShare(k) { const w = who(); if (!s.profileDone[w]) return; s.share[w] = k; commit(); toast(k === 'nothing' ? 'Your profile shows as Not shared' : 'Sharing updated'); },
      takeProfile() { s.profileDone.member = true; commit(); toast('Profile ready. Private to you.'); },
      openConsent(id) { if (s.plan === 'free') { toast('Profile modules come with the Team plan'); return; } s.consent = id; s.consentOk = false; commit(); },
      consentToggle() { s.consentOk = !s.consentOk; commit(); },
      consentCancel() { s.consent = null; commit(); },
      consentAccept() { if (!s.consentOk || !s.consent) return; const w = who(); if (!s.modules[w].includes(s.consent)) s.modules[w].push(s.consent); s.consent = null; commit(); toast('Module added. Only you see the result.'); },
      removeModule(id) { const w = who(); s.modules[w] = s.modules[w].filter(x => x !== id); commit(); toast('Module result deleted'); },
      toggleNav() { s.ui.nav = s.ui.nav === 'vertical' ? 'horizontal' : 'vertical'; commit(); },
      toggleWide() { s.ui.wide = !s.ui.wide; commit(); },
      setNav(v) { s.ui.nav = v; commit(); },
      setWide(v) { s.ui.wide = v; commit(); },
      openPerson(id) { if (s.role === 'coach') return; s.route = 'people'; s.peopleTab = 'person'; s.person = id; commit(); top(); },
      toastMsg(t) { toast(t); },
      gov() { if (s.role !== 'leader' || s.plan === 'free') { toast(s.plan === 'free' ? 'Scheduling comes with the Team plan' : 'Only the team leader changes this'); return false; } return true; },
      setSched(f, v) { if (!A.gov()) return; s.sched[f] = v; commit(); toast('Schedule updated'); },
      rhythm(d) { if (!A.gov()) return; s.sched.rhythm = Math.max(3, Math.min(12, s.sched.rhythm + d)); commit(); },
      windowDays(d) { if (!A.gov()) return; s.sched.window = Math.max(7, Math.min(30, s.sched.window + d)); commit(); },
      toggleReminder(d) { if (!A.gov()) return; const r = s.sched.reminders; s.sched.reminders = r.includes(d) ? r.filter(x => x !== d) : r.concat(d); commit(); },
      toggleOutside() { toast('The outside view comes with the Organisation plan'); },
      openRound3() { if (!A.gov()) return; s.sched.r3 = 'open'; s.sched.r3answered = 0; commit(); toast('Round 3 is open for ' + s.sched.window + ' days. Reminders go only to non-responders.'); },
      simRound3() { if (s.sched.r3 !== 'open') return; s.sched.r3answered++; if (s.sched.r3answered >= s.members.length) { s.sched.r3 = 'closed'; commit(); toast('Round 3 closed at 100% response'); return; } commit(); },
      pweeks(d) { if (!A.gov()) return; s.pcfg.weeks = Math.max(2, Math.min(8, s.pcfg.weeks + d)); commit(); },
      prot(n) { if (!A.gov()) return; s.pcfg.rotating = n; commit(); },
      pagree() { if (!A.gov()) return; s.pcfg.agreements = !s.pcfg.agreements; commit(); },
      pwin(d) { if (!A.gov()) return; s.pcfg.windowDays = Math.max(3, Math.min(14, s.pcfg.windowDays + d)); commit(); },
      rateLeader() { if (s.tlf.ratedMember) return; s.tlf.ratedMember = true; s.tlf.raters = Math.min(s.members.length - 1, s.tlf.raters + 1); commit(); toast('Thanks. Your rating is anonymous and only counts in the averages.'); },
      openTlf() { if (!A.gov()) return; s.tlf.status = 'open'; s.tlf.raters = 0; s.tlf.ratedMember = false; commit(); toast('Feedback round open for 14 days. It needs 4 raters besides you.'); },
      simTlf() { if (s.tlf.status !== 'open') return; s.tlf.raters = Math.min(s.members.length - 1, s.tlf.raters + 1); if (s.tlf.raters === 4) toast('4 raters in. You see the averages first.'); commit(); },
      closeTlf() { s.tlf.status = 'closed'; commit(); },
      toggleTlfShare() { s.tlf.shared = !s.tlf.shared; commit(); toast(s.tlf.shared ? 'Averages shared with the group' : 'Averages are private to you again'); },
      toggleCvGroup() { if (!A.gov()) return; s.cv.group = !s.cv.group; commit(); toast(s.cv.group ? 'Contribution view on. Each person still opts in.' : 'Contribution view off for the group'); },
      toggleCvOpt() { const k = who(); s.cv.optIn[k] = !s.cv.optIn[k]; commit(); toast(s.cv.optIn[k] ? 'You opted in to be rated' : 'You opted out. No new ratings are collected.'); },
      toggleCvShare() { const k = who(); s.cv.shared[k] = !s.cv.shared[k]; commit(); toast(s.cv.shared[k] ? 'Summary shared with the group' : 'Summary is private to you again'); },
      startRun(id, target) { const key = id + (target || ''); const d = s.drafts[key]; s.run = { id: id, target: target || null, phase: 'intro', idx: d ? d.idx : 0, ans: d ? Object.assign({}, d.ans) : {} }; commit(); },
      runStart() { if (!s.run) return; s.run.phase = 'q'; commit(); },
      runAnswer(k) { const R = s.run; if (!R) return; R.ans[R.idx] = k; commit(); clearTimeout(A._adv); const at = R.idx; A._adv = setTimeout(() => { if (s.run && s.run.phase === 'q' && s.run.idx === at) A.runNext(); }, 260); },
      runText(v) { if (!s.run) return; s.run.ans[s.run.idx] = v; commit(); },
      runNext() { const R = s.run; if (!R) return; const f = flatOf(s, R); const it = f[R.idx]; if (it && !it.open && R.ans[R.idx] == null) return; if (R.idx < f.length - 1) R.idx++; else R.phase = 'review'; commit(); },
      runBack() { const R = s.run; if (!R) return; if (R.phase === 'review') { R.phase = 'q'; R.idx = flatOf(s, R).length - 1; } else if (R.idx > 0) R.idx--; commit(); },
      runJump(i) { const R = s.run; if (!R) return; R.phase = 'q'; R.idx = Math.max(0, i); commit(); },
      runFill() { const R = s.run; if (!R) return; flatOf(s, R).forEach((it, k) => { if (!it.open && R.ans[k] == null) R.ans[k] = 2 + ((k * 7 + 3) % 4); }); R.phase = 'review'; commit(); },
      runExit() { const R = s.run; if (!R) return; const saved = R.phase !== 'done' && Object.keys(R.ans).length > 0; if (saved) s.drafts[R.id + (R.target || '')] = { idx: R.idx, ans: R.ans }; s.run = null; commit(); if (saved) toast('Saved. You can resume where you stopped.'); },
      runSubmit() { const R = s.run; if (!R) return; const f = flatOf(s, R); if (f.some((it, k) => !it.open && R.ans[k] == null)) return; const prev = isPreview(s, R);
        if (!prev) {
          if (R.id === 'std' || R.id === 'ext' || R.id === 'pulse') { const rd = s.rounds.find(x => x.type === R.id && x.status === 'open' && !x.mine); if (rd) { rd.mine = true; rd.answered = Math.min(rd.of, rd.answered + 1); } }
          if (R.id === 'pulse' && !s.pulseMine) { s.pulseMine = true; s.pulse.answered = Math.min(s.pulse.of, s.pulse.answered + 1); }
          if (R.id === 'tlf') { if (s.role === 'member') { s.tlf.ratedMember = true; s.tlf.raters = Math.min(s.members.length - 1, s.tlf.raters + 1); const tr = s.rounds.find(x => x.type === 'tlf' && x.status === 'open'); if (tr) tr.answered = s.tlf.raters; } else s.tlf.selfDone = true; }
          if (R.id === 'cv' && R.target && !s.cvRated.includes(R.target)) s.cvRated.push(R.target);
          if (R.id === 'checkin') { s.mtg.ci.mine = true; s.mtg.ci.answered++; }
          if (R.id === 'c360' && R.target) { const P = s.c360.people[R.target]; const mine = R.target === (s.role === 'member' ? 'lj' : 'kn'); if (mine && P) P.selfDone = true; else if (P) { s.c360.rated.push(R.target); P.raters.peer.n = Math.min(P.raters.peer.of, P.raters.peer.n + 1); } }
          if (R.id === 'lpq' || R.id === 'lpf') { const sum = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0]; f.forEach((it, k) => { const v = R.ans[k]; if (v == null || it.d == null) return; sum[it.d] += it.r ? 6 - v : v; cnt[it.d]++; }); const w = s.role === 'member' ? 'member' : 'leader'; const was = s.profileDone[w]; s.lpScores[w] = sum.map((x, i) => cnt[i] ? Math.round(Math.max(4, Math.min(96, (x / cnt[i] - 1) / 4 * 100))) : 50); s.lpLevel[w] = R.id; s.profileDone[w] = true; if (was) s.share[w] = 'nothing'; }
        }
        R.preview = prev; R.phase = 'done'; delete s.drafts[R.id + (R.target || '')]; commit(); },
      advanceRound(id) { const rd = s.rounds.find(x => x.id === id); if (!rd || !A.gov()) return; const nx = { scheduled: 'open', open: 'closed', closed: 'released', released: 'session', session: 'followup' }[rd.status]; if (!nx) return;
        if (nx === 'open') { rd.status = 'open'; rd.answered = 0; rd.mine = false; rd.opens = 'Today'; if (rd.type === 'tlf') Object.assign(s.tlf, { status: 'open', raters: 0, ratedMember: false, selfDone: false }); commit(); toast(rd.label + ' is open. Members get the link by email.'); return; }
        if (nx === 'closed') { if (rd.answered < 4 && !rd.extended) { rd.extended = true; rd.closes = rd.closes + ' + 7 days'; commit(); toast('Fewer than 4 answers, so the round is extended once by 7 days.'); return; } if (rd.type === 'tlf') s.tlf.status = 'closed'; if (rd.answered < 4) { rd.status = 'missed'; commit(); toast('Closed without a result. Fewer than 4 answered.'); return; } rd.status = 'closed'; commit(); toast('Closed at ' + rd.answered + ' of ' + rd.of + '.'); return; }
        if (nx === 'released') { rd.status = 'released'; rd.released = 'Today'; commit(); toast('Results released to every member at the same moment.'); return; }
        if (nx === 'session') { rd.status = 'session'; rd.session = 'Today'; commit(); toast('Results session logged. Choose up to 2 focus areas in Develop.'); return; }
        rd.status = 'followup'; rd.follow = s.focus.length + ' focus areas · ' + s.actions.filter(a => !a.done).length + ' open actions'; commit(); toast('Follow-up started. Pulses now track the focus areas.'); },
      simRound(id) { const rd = s.rounds.find(x => x.id === id); if (!rd || rd.status !== 'open' || rd.answered >= rd.of) return; rd.answered++; if (rd.type === 'tlf') s.tlf.raters = Math.min(s.members.length - 1, rd.answered); if (rd.answered === 4) toast('4 answers in. A result is guaranteed.'); if (rd.answered >= rd.of && rd.type !== 'tlf') { rd.status = 'closed'; commit(); toast('Everyone has answered. The round closed at 100%.'); return; } commit(); },
      cancelRound(id) { if (!A.gov()) return; s.rounds = s.rounds.filter(x => x.id !== id); commit(); toast('Scheduled round removed'); },
      wizSet(f, v) { if (!A.gov()) return; s.wiz[f] = v; commit(); },
      wizPerson(id) { if (!A.gov()) return; const p = s.wiz.people; s.wiz.people = p.includes(id) ? p.filter(x => x !== id) : p.concat(id); commit(); },
      wizFrom(id) { s.wiz.type = id; s.route = 'assess'; s.assessTab = 'schedule'; commit(); top(); },
      wizSchedule(now) { if (!A.gov()) return; const W = s.wiz; const ppl = W.people.filter(id => s.members.some(m => m.id === id)); if (ppl.length < 4) { toast('A round needs at least 4 participants to give a result'); return; } const diag = W.type === 'std' || W.type === 'ext'; const n = s.rounds.filter(x => x.type === 'std' || x.type === 'ext').length + 1; const start = now ? new Date(2026, 9, 4) : new Date(W.opens); const cl = new Date(start.getTime() + W.window * 864e5);
        const rd = { id: 's' + Date.now(), type: W.type, label: diag ? 'Round ' + n : W.type === 'pulse' ? 'Extra pulse' : W.type === 'tlf' ? 'Feedback round' : 'Contribution round', opens: now ? 'Today' : W.opens.replace(/ \d{4}$/, ''), closes: fmtD(cl), status: now ? 'open' : 'scheduled', answered: 0, of: W.type === 'tlf' ? ppl.filter(id => id !== 'kn').length : ppl.length, mine: false, notice: now ? '' : '7 days ahead' };
        s.rounds.push(rd); if (now && W.type === 'tlf') Object.assign(s.tlf, { status: 'open', raters: 0, ratedMember: false, selfDone: false }); s.assessTab = 'overview'; commit(); toast(now ? rd.label + ' is open now' : rd.label + ' scheduled for ' + W.opens); },
      goPlan() { s.route = 'settings'; s.set.tab = 'plan'; s.bill.down = false; if (s.plan === 'free' && s.role === 'leader') s.bill.step = 1; commit(); top(); },
      setTab(t) { s.set.tab = t; if (t === 'plan' && s.plan === 'team' && s.bill.step !== 4) s.bill.step = 0; commit(); },
      setSet(f, v) { s.set[f] = v; commit(); },
      saveSet(msg) { toast(msg || 'Saved'); },
      toggleNotif(k) { s.set.notif[k] = !s.set.notif[k]; commit(); },
      setAnon(n) { if (s.role !== 'leader') { toast('Only the team leader changes this'); return; } if (n < 4) return; s.set.anon = n; commit(); toast('Results now need ' + n + ' answers. Lumio AS requires at least 4.'); },
      setGroupName(v) { if (s.role !== 'leader') return; s.save.groupName = v; commit(); },
      billSet(f, v) { s.bill[f] = v; commit(); },
      billStep(n) { s.bill.step = n; commit(); top(); },
      billNext() { const B = s.bill; if (B.step === 2 && (!B.company.trim() || !validEmail(B.email))) { toast('Add a company name and a valid invoice email'); return; } B.step = Math.min(3, B.step + 1); commit(); top(); },
      billBack() { s.bill.step = Math.max(s.plan === 'free' ? 1 : 0, s.bill.step - 1); commit(); top(); },
      billConfirm() { if (s.role !== 'leader') return; s.plan = 'team'; s.bill.step = 4; s.bill.since = '5 Oct 2026'; commit(); top(); toast('Team plan active. Your scan results carried over.'); },
      downStart() { s.bill.down = true; commit(); },
      downCancel() { s.bill.down = false; commit(); },
      downConfirm() { s.plan = 'free'; s.bill.down = false; s.bill.step = 1; commit(); toast('Switched to Free. Team-plan data is kept for 90 days.'); },
      talkToUs() { toast('Thanks. Someone from LeaderPact will contact you within one working day.'); },
      deleteProfile() { const k = s.role === 'member' ? 'member' : 'leader'; s.profileDone[k] = false; delete s.lpScores[k]; s.share[k] = 'nothing'; commit(); toast('Your Leader Profile results are deleted'); },
      simPulse() { if (s.pulse.answered >= s.pulse.of) return; s.pulse.answered++; commit(); if (s.pulse.answered === s.pulse.of) toast('Everyone has answered pulse 6'); },
      addInit(id) { if (!SC[id]) return; const nid = 'p' + Date.now(); s.proj.push({ id: nid, title: 'Improve ' + SC[id].label.toLowerCase(), scale: id, owner: s.role === 'member' ? 'lj' : 'kn', start: 0, end: 5, target: fmt(Math.min(5, SC[id].r2 + 0.4)), kpi: '', status: 'todo', ms: [{ t: 'Agree what good looks like', due: '30 Oct', m: 0, done: false }, { t: 'Choose and start a practice', due: '15 Nov', m: 1, done: false }, { t: 'Check the pulse trend', due: '15 Jan', m: 3, done: false }, { t: 'Read the result in round 3', due: '15 Mar', m: 5, done: false }] }); s.route = 'develop'; s.devTab = 'plan'; s.projOpen = nid; commit(); top(); toast('Initiative added to the plan'); },
      toggleMs(pid, j) { const p = s.proj.find(x => x.id === pid); if (!p) return; p.ms[j].done = !p.ms[j].done; if (p.ms.every(m => m.done)) p.status = 'done'; else if (p.status === 'todo') p.status = 'on'; else if (p.status === 'done') p.status = 'on'; commit(); },
      projStatus(pid, k) { const p = s.proj.find(x => x.id === pid); if (p) { p.status = k; commit(); } },
      setNewMs(pid, v) { s.newMs[pid] = v; commit(); },
      addMs(pid) { const p = s.proj.find(x => x.id === pid); const t = (s.newMs[pid] || '').trim(); if (!p || !t) return; p.ms.push({ t, due: 'Mar', m: 5, done: false }); s.newMs[pid] = ''; commit(); },
      removeProj(pid) { s.proj = s.proj.filter(x => x.id !== pid); commit(); toast('Initiative removed'); },
      setRoleM(k, id) { s.mtg.roles[k] = id; commit(); },
      nsName(v) { s.mtg.ns.name = v; commit(); },
      nsPurpose(k) { const p = s.mtg.ns.purposes; s.mtg.ns.purposes = p.includes(k) ? p.filter(x => x !== k) : p.concat(k); commit(); },
      addSeries() { const N = s.mtg.ns; if (!N.name.trim()) return; if (!N.purposes.length) { toast('A series needs at least one purpose'); return; } s.mtg.series.push({ id: 's' + Date.now(), name: N.name.trim(), when: 'To be set', len: '60 min', purposes: N.purposes.slice(), next: 'Not scheduled' }); s.mtg.ns = { name: '', purposes: [] }; commit(); toast('Meeting series added'); },
      toggleHeard() { const it = s.agenda[s.live.idx]; if (!it) return; s.mtg.heard[it.id] = !s.mtg.heard[it.id]; commit(); },
      setPark(v) { s.mtg.newPark = v; commit(); },
      addPark() { const t = (s.mtg.newPark || '').trim(); if (!t) return; s.mtg.parked.unshift(t); s.mtg.newPark = ''; commit(); },
      simCheckin() { s.mtg.ci.answered = Math.min(s.live.online || 7, s.mtg.ci.answered + 1); commit(); },
      c360Tab(t) { s.c360.tab = t; commit(); },
      c360Start() { const P = s.c360.people[ME[s.role].id]; s.c360.people[ME[s.role].id] = Object.assign(P || {}, { status: 'nominate', selfDone: false, shared: false, raters: (P && P.raters) || { mgr: { n: 0, of: 1 }, peer: { n: 0, of: s.members.length - 1 }, dr: { n: 0, of: 0 }, oth: { n: 0, of: 0 } } }); commit(); },
      c360Adj(g, d) { const P = s.c360.people[ME[s.role].id]; if (!P || P.status !== 'nominate') return; const r = P.raters[g]; const max = g === 'mgr' ? 2 : g === 'peer' ? s.members.length - 1 : 15; r.of = Math.max(0, Math.min(max, r.of + d)); commit(); },
      c360Launch() { const P = s.c360.people[ME[s.role].id]; if (!P) return; const R = P.raters; if (R.peer.of < 3 || (R.dr.of > 0 && R.dr.of < 3) || (R.oth.of > 0 && R.oth.of < 3)) { toast('Each anonymous rater group needs 3 or more people, or none'); return; } P.status = 'collecting'; Object.values(R).forEach(x => x.n = 0); commit(); toast('Invitations sent. The window is 14 days.'); },
      c360Sim() { const P = s.c360.people[ME[s.role].id]; if (!P || P.status !== 'collecting') return; const g = ['peer', 'dr', 'oth', 'mgr'].find(k => P.raters[k].n < P.raters[k].of); if (!g) return; P.raters[g].n++; commit(); },
      c360Close() { const P = s.c360.people[ME[s.role].id]; if (!P) return; const tot = Object.values(P.raters).reduce((a, x) => a + x.n, 0); if (tot < 3) { toast('A report needs at least 3 raters besides you'); return; } P.status = 'report'; if (!C360S[ME[s.role].id]) C360S[ME[s.role].id] = { self: [3.9, 3.6, 3.8, 3.7, 4.1, 3.5, 3.8, 4.2], mgr: [3.8, 3.7, 3.6, 3.4, 4.0, 3.6, 3.5, 4.3], peer: [3.6, 3.3, 3.7, 3.5, 3.8, 3.4, 3.6, 4.1], dr: [3.9, 3.5, 3.5, 3.8, 3.7, 3.3, 3.7, 4.2], oth: [3.7, 3.4, 3.6, 3.5, 3.7, 3.8, 3.4, 4.0], themes: [[['Energy in discussions', 6], ['Product knowledge', 5]], [['Prepare more for meetings', 5], ['Listen before arguing', 4]]] }; commit(); toast('Report ready. Only you can see it.'); },
      c360Share() { const P = s.c360.people[ME[s.role].id]; if (!P) return; P.shared = !P.shared; commit(); toast(P.shared ? 'Report summary shared with the group' : 'Report is private again'); },
      c360Dev(kind, id) { const L = s.c360.dev[kind]; if (L.includes(id)) s.c360.dev[kind] = L.filter(x => x !== id); else { if (L.length >= 2) { toast('Pick at most 2'); return; } L.push(id); } commit(); },
      c360See(id) { s.c360.view = id; s.c360.tab = 'view'; commit(); top(); },
      projToAgenda(pid) { const p = s.proj.find(x => x.id === pid); if (!p || s.agenda.some(a => a.proj === pid)) return; const id = 'a' + Date.now(); s.agenda.push({ id, title: 'Plan follow-up: ' + p.title, type: 'Follow-up', outcome: 'Agree the next step and owner for this initiative.', owner: p.owner, minutes: 10, task: 't3', ok: false, pre: 'none', proj: pid }); s.sel = id; commit(); toast('Added to Thursday\'s agenda as a 10-minute follow-up'); },
      protoToggle() { s.protoOpen = !s.protoOpen; commit(); }
    };
    store.A = A;
    window.__lt = window.__lt || {}; window.__lt[key] = store;
    setInterval(() => { const L = s.live; if (L.started && !L.ended && L.running && L.secs > 0) { L.secs--; commit(); } }, 1000);
    return store;
  }

  const DEF = {
    opt: { on: { bg: '#eee', fg: '#111', bd: '#111' }, off: { bg: '#fff', fg: '#111', bd: '#ddd' } },
    avatars: [['#eee', '#111']], gauge: ['#333', '#999', '#ccc'],
    evStrong: { bg: '#e6f0ec', fg: '#24564c' }, evModerate: { bg: '#f5f0dc', fg: '#5f4e10' }, evOther: { bg: '#eef0f3', fg: '#4f5562' },
    dotOn: '#333', dotOff: '#ddd', toggleOn: '#333', toggleOff: '#ccc', flag: '#d9961a', flagBg: '#fffaf0'
  };
  const PROTO = { on: { bg: '#ffffff', fg: '#111111', bd: '#ffffff' }, off: { bg: 'transparent', fg: '#d6d6d6', bd: '#4a4a4a' } };

  function view(store, T0) {
    const T = Object.assign({}, DEF, T0 || {});
    const s = store.s, A = store.A;
    const role = s.role, leader = role === 'leader', member = role === 'member', coach = role === 'coach';
    const free = s.plan === 'free', paid = !free;
    const sty = (k, on) => { const t = (T[k] || T.tab || T.opt)[on ? 'on' : 'off']; return { bg: t.bg, fg: t.fg, bd: t.bd }; };
    const av = tone => { const a = T.avatars[(tone || 0) % T.avatars.length]; return { abg: a[0], afg: a[1] }; };
    const mem = id => s.members.find(m => m.id === id) || (id === 'av' ? { id: 'av', name: 'Anne Vik', initials: 'AV', role: 'Coach', tone: 5 } : null);
    const person = id => { const m = mem(id); return m ? Object.assign({ name: m.name, first: m.name.split(' ')[0], initials: m.initials, role: m.role }, av(m.tone)) : { name: 'No owner', first: '—', initials: '?', role: '', abg: T.dotOff, afg: '#555' }; };
    const R = s.route;
    const r = {}; ROUTES.forEach(k => r[k] = R === k);
    r.public = PUBLIC.includes(R); r.app = !r.public;
    r.agenda = R === 'meetings' && s.meetTab === 'agenda'; r.live = R === 'meetings' && s.meetTab === 'live';
    const me = Object.assign({}, ME[role], av(role === 'leader' ? 0 : role === 'member' ? 3 : 5));
    const paidArea = ['group', 'results', 'develop', 'meetings', 'people', 'assess', 'cxo'].includes(R);
    const sample = free && paidArea;
    const blocked = coach && !s.coachAccess && r.app;
    const canAct = !sample && !coach;
    const gate = { ok: !blocked, blocked, sample, notSample: !sample, sampleLeader: sample && leader, sampleOther: sample && !leader };
    const nav = (coach ? NAV.filter(n => n.coach) : NAV).map(n => Object.assign({ id: n.id, label: n.label, icon: n.icon, on: R === n.id, go: () => A.go(n.id), sample: free && !!n.paid }, sty('nav', R === n.id)));
    const roleLabel = { leader: 'Leader', member: 'Member', coach: 'Coach' }[role];

    // scan
    const i = s.scan.idx, ans = s.scan.answers;
    const answeredCount = ans.filter(a => a != null).length;
    const scan = {
      n: i + 1, total: 12, pct: ((i + (ans[i] != null ? 1 : 0)) / 12 * 100).toFixed(1) + '%',
      text: SCAN[i][0], theme: THEMES[SCAN[i][1]].label,
      options: OPTS.map((label, k) => Object.assign({ label, n: k + 1, on: ans[i] === k + 1, pick: () => A.answer(k + 1) }, sty('opt', ans[i] === k + 1))),
      canNext: ans[i] != null, nextOp: ans[i] != null ? '1' : '0.45', next: A.scanNext, back: A.scanBack, hasBack: i > 0, backOp: i > 0 ? '1' : '0.35',
      nextLabel: i === 11 ? 'See my view' : 'Next', start: A.startScan, answeredCount
    };
    const own = THEMES.map((t, ti) => { const v = SCAN.map((q, qi) => q[1] === ti ? ans[qi] : null).filter(x => x != null); return v.length ? mean(v) : 3; });
    const ownSorted = own.map((v, k) => [v, k]).sort((a, b) => b[0] - a[0]);
    const personal = {
      themes: THEMES.map((t, k) => ({ label: t.label, level: fmt(own[k]), pct: pct(own[k]) })),
      high: THEMES[ownSorted[0][1]].label, low: THEMES[ownSorted[5][1]].label,
      email: s.save.email, setEmail: e => A.setSave('email', e.target.value),
      groupName: s.save.groupName, setGroupName: e => A.setSave('groupName', e.target.value),
      size: s.save.size, inc: () => A.size(1), dec: () => A.size(-1),
      canSave: validEmail(s.save.email) && !!s.save.groupName.trim(), saveOp: validEmail(s.save.email) && s.save.groupName.trim() ? '1' : '0.45',
      save: A.saveGroup, submit: A.submitMember, isMember: member, notMember: !member,
      emailHint: s.save.email && !validEmail(s.save.email) ? 'Enter a full email address' : 'Used only to save your view and sign you in. No password.'
    };

    // invite + team view
    const cap = s.save.size, answered = Math.min(s.invite.answered, cap);
    const needed = Math.max(0, 4 - answered);
    const invite = {
      link: 'leaderpact.com/j/lumio-7Kq', copy: A.copyLink, copyLabel: s.invite.copied ? 'Copied' : 'Copy',
      answered, cap, needed, neededText: needed + ' more answer' + (needed === 1 ? '' : 's') + ' needed',
      open: answered >= 4, notOpen: answered < 4, simulate: A.simulate, canSimulate: answered < cap, simOp: answered < cap ? '1' : '0.4',
      pct: (answered / cap * 100).toFixed(1) + '%',
      dots: Array.from({ length: cap }, (_, k) => ({ bg: k < answered ? T.dotOn : T.dotOff, on: k < answered })),
      openTeam: () => A.go('team'), groupName: s.save.groupName || 'Your group', showLink: !member, isMember: member
    };
    const resp = [own].concat(SEED.slice(0, Math.max(0, answered - 1)));
    const teamThemes = THEMES.map((t, ti) => {
      const xs = resp.map(x => x[ti]); const m = mean(xs);
      const vr = xs.length > 1 ? xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1) : 0;
      const rwg = 1 - vr / 2;
      return { label: t.label, level: fmt(m), pct: pct(m), agree: rwg > 0.7 ? 'High agreement' : rwg > 0.5 ? 'Medium agreement' : 'Views differ', rwg, m, differ: rwg <= 0.5 };
    });
    const agreeOn = teamThemes.filter(x => x.rwg > 0.7).sort((a, b) => b.m - a.m)[0] || teamThemes[0];
    const differOn = teamThemes.slice().sort((a, b) => a.rwg - b.rwg)[0];
    const team = {
      themes: teamThemes, answered, cap, ready: answered >= 4, notReady: answered < 4, needed,
      agreeOn: agreeOn.label, differOn: differOn.label, hasDiffer: differOn.rwg <= 0.5,
      upsell: free && leader, ask: free && !leader, onTeam: paid, toGroup: () => A.go('group'), toInvite: () => A.go('invite'),
      groupName: s.save.groupName || 'Your group'
    };
    const upgrade = { open: s.upgradeOpen, show: A.openUpgrade, hide: A.closeUpgrade, confirm: A.confirmUpgrade, price: PRICE, per: 'per group per year', canBuy: leader };

    // results
    const rnd = s.res.round;
    const lv = sc => rnd === 2 ? sc.r2 : sc.r1;
    const change = sc => { if (rnd === 1) return 'First round'; const d = sc.r2 - sc.r1; return Math.abs(d) >= 0.29 ? (d > 0 ? '+' : '−') + fmt(Math.abs(d)) : 'Stable'; };
    const changed = sc => rnd === 2 && Math.abs(sc.r2 - sc.r1) >= 0.29;
    const evS = ev => ev === 'Strong' ? T.evStrong : ev === 'Moderate' ? T.evModerate : T.evOther;
    const row = sc => ({
      id: sc.id, label: sc.label, sub: READ_NOTE[sc.read] || '', hasSub: !!READ_NOTE[sc.read], ev: sc.ev, evBg: evS(sc.ev).bg, evFg: evS(sc.ev).fg,
      level: fmt(lv(sc)), pct: pct(lv(sc)), tick: pct(sc.r1), showTick: rnd === 2, change: change(sc), changed: changed(sc), agree: AG[sc.ag], differ: sc.ag === 'low',
      isFocus: s.focus.includes(sc.id), open: () => A.openScale(sc.id)
    });
    const nonOut = SCALES.filter(x => x.layer !== 'outcomes');
    const cnt = { high: nonOut.filter(x => x.ag === 'high').length, medium: nonOut.filter(x => x.ag === 'medium').length, low: nonOut.filter(x => x.ag === 'low').length };
    const a1 = cnt.high / 21 * 180, a2 = a1 + cnt.medium / 21 * 180;
    const g = T.gauge;
    const L = id => lv(SC[id]);
    const pats = [];
    if (L('safety') < 3 && SC.safety.ag === 'low') pats.push({ tag: 'Safety low · agreement low', title: 'A split team', text: 'Some feel safe, others do not. Talk about the difference before any team-wide exercise.', cta: 'Lessons round', go: () => A.openPractice('lessons') });
    if (L('safety') >= 4 && L('integration') < 3) pats.push({ tag: 'Safety high · integration low', title: 'Safety is not turning into joint work', text: 'Work on collaboration, information sharing and joint decisions.', cta: 'Joint decision log', go: () => A.openPractice('decisionLog') });
    if (L('taskConflict') >= 4 && L('relConflict') >= 4) pats.push({ tag: 'Task conflict high · relationship conflict high', title: 'Disagreement has turned personal', text: 'Rebuild trust and reset ground rules before debating issues.', cta: 'Lessons round', go: () => A.openPractice('lessons') });
    if (L('taskConflict') < 3 && L('dialogue') < 3) pats.push({ tag: 'Task conflict low · dialogue low', title: 'Possibly silence, not agreement', text: 'Few open disagreements and little real dialogue often mean people hold back. Try the process-comment norm and structured rounds.', cta: 'Structured round', go: () => A.openPractice('round') });
    if (L('meetingGoals') < 3 && L('focus') < 3) pats.push({ tag: 'Meeting goals low · focus low', title: 'Meeting discipline is the first problem', text: 'Fix agenda item types and desired outcomes before anything else.', cta: 'Outcome first', go: () => A.openPractice('outcomeFirst') });
    if (L('political') >= 4) pats.push({ tag: 'Political behaviour high', title: 'Hidden agendas or coalitions', text: 'Bring agendas into the open, led by the team leader.', cta: 'Leader speaks last', go: () => A.openPractice('leaderLast') });
    const lowAg = nonOut.filter(x => x.ag === 'low' && x.read !== 'descriptive')[0];
    if (lowAg && pats.length < 3) pats.push({ tag: lowAg.label + ' · low agreement', title: 'Your views differ on ' + lowAg.label.toLowerCase(), text: 'Some of you rate this high, others low. Talk about the difference before choosing a fix.', cta: 'Open the scale', go: () => A.openScale(lowAg.id) });
    const sel = SC[s.res.scale] || SC.focus;
    const selPractice = PRACTICES.find(p => p.scale === sel.id);
    const focusable = sel.layer !== 'outcomes' && sel.read !== 'descriptive';
    const results = {
      rounds: [[2, 'Round 2 · Sep 2026'], [1, 'Round 1 · Mar 2026']].map(([n, l]) => Object.assign({ label: l, on: rnd === n, pick: () => A.setRes({ round: n }) }, sty('tab', rnd === n))),
      roundLabel: rnd === 2 ? 'Round 2' : 'Round 1', roundMeta: rnd === 2 ? '8 of 8 answered · closed 28 Sep · released to all members 30 Sep' : '8 of 8 answered · closed 16 Mar · released 18 Mar · first round, so no change is shown',
      isR2: rnd === 2,
      overview: s.res.depth === 'overview', scaleView: s.res.depth === 'scale', itemsView: s.res.depth === 'items',
      toOverview: () => A.setRes({ depth: 'overview' }), toScale: () => A.setRes({ depth: 'scale' }), toItems: () => A.setRes({ depth: 'items' }),
      depths: [['questions', 'All scales and items'], ['overview', 'Overview'], ['scale', 'Scale'], ['items', 'Items']].map(([id, l]) => Object.assign({ label: l, on: s.res.depth === id, pick: () => A.setRes({ depth: id }) }, sty('tab', s.res.depth === id))),
      layers: [['all', 'All']].concat(LAYERS.slice(0, 3)).map(([id, l]) => Object.assign({ label: l, count: id === 'all' ? 21 : SCALES.filter(x => x.layer === id).length, on: s.res.layer === id, pick: () => A.setRes({ layer: id }) }, sty('chip', s.res.layer === id))),
      rows: SCALES.filter(x => s.res.layer === 'all' ? x.layer !== 'outcomes' : x.layer === s.res.layer).map(row),
      outcomes: SCALES.filter(x => x.layer === 'outcomes').map(row),
      cnt, highPct: (cnt.high / 21 * 100).toFixed(1) + '%', medPct: (cnt.medium / 21 * 100).toFixed(1) + '%', lowPct: (cnt.low / 21 * 100).toFixed(1) + '%',
      gaugeBg: `conic-gradient(from 270deg, ${g[0]} 0deg ${a1 - 1}deg, transparent ${a1 - 1}deg ${a1 + 1}deg, ${g[1]} ${a1 + 1}deg ${a2 - 1}deg, transparent ${a2 - 1}deg ${a2 + 1}deg, ${g[2]} ${a2 + 1}deg 180deg, transparent 180deg)`,
      patterns: pats.slice(0, 3), patternCount: Math.min(3, pats.length), noPatterns: pats.length === 0,
      focusChips: s.focus.map(id => ({ label: SC[id].label, open: () => A.openScale(id) })), focusCount: s.focus.length, focusOpen: s.focus.length < 2,
      chooseFocus: () => { A.set({ route: 'develop', devTab: 'focus' }); },
      canOpenRound: leader && !sample, cannotOpenRound: !(leader && !sample), openRound: A.openRound,
      roundReason: sample ? 'Comes with the Team plan' : 'Only the team leader can open a round',
      sel: Object.assign(row(sel), {
        layerLabel: (LAYERS.find(l => l[0] === sel.layer) || ['', ''])[1], guide: guide(sel), readNote: READ_NOTE[sel.read] || 'Higher is better',
        r1: fmt(sel.r1), r2: fmt(sel.r2), r1pct: pct(sel.r1), r2pct: pct(sel.r2),
        items: (ITEMS[sel.id] || []).slice(0, rnd === 1 ? 3 : 2).map((t, k) => { const m = clamp(lv(sel) + [0.2, -0.1, -0.1][k]); const d = dist(m, sel.ag); return { n: k + 1, text: t, mean: fmt(m), pct: pct(m), bars: d.map((c, j) => ({ n: c, h: (c / 8 * 100).toFixed(1) + '%', label: String(j + 1) })) }; }),
        hasPractice: !!selPractice && sel.ev !== 'Mixed', noPractice: !selPractice || sel.ev === 'Mixed',
        practiceName: selPractice ? selPractice.name : '', practiceFormat: selPractice ? selPractice.format : '', goPractice: () => selPractice && A.openPractice(selPractice.id),
        canFocus: focusable && !s.focus.includes(sel.id) && s.focus.length < 2 && canAct,
        focusFull: focusable && !s.focus.includes(sel.id) && s.focus.length >= 2 && canAct,
        makeFocus: () => A.addFocus(sel.id), noFocusReason: !focusable ? (sel.layer === 'outcomes' ? 'Outcomes are not chosen as focus areas' : 'Descriptive scales have no target') : ''
      })
    };
    results.sel.isFocusNow = s.focus.includes(sel.id);
    results.sel.cantFocus = !focusable;

    // agenda
    const ag = s.agenda.map((it, k) => {
      const st = itemState(s, it); const o = person(it.owner); const isSel = s.sel === it.id;
      const task = s.charter.tasks.find(t => t.id === it.task);
      return Object.assign({
        id: it.id, n: k + 1, title: it.title || 'Untitled item', type: it.type || 'No type', hasType: !!it.type, outcome: it.outcome || 'No desired outcome yet', hasOutcome: !!(it.outcome && it.outcome.trim()),
        owner: o.name, ownerFirst: o.first, initials: o.initials, abg: o.abg, afg: o.afg, minutes: it.minutes, ready: st.ready, notReady: !st.complete, flagged: st.flagged && st.complete, sel: isSel,
        task: task ? task.title : 'No team task', select: () => A.selectItem(it.id),
        state: st.flagged ? 'Matches no team task' : !st.complete ? 'Add ' + st.missing.join(', ') : 'Ready',
        cardBd: st.flagged ? T.flag : isSel ? sty('card', true).bd : sty('card', false).bd, cardBg: isSel ? sty('card', true).bg : st.flagged ? T.flagBg : sty('card', false).bg,
        cardLine: st.complete ? 'solid' : 'dashed', grow: String(it.minutes)
      });
    });
    const readyCount = ag.filter(x => x.ready).length;
    const it = s.agenda.find(x => x.id === s.sel);
    const itSt = it ? itemState(s, it) : null;
    const canEditAgenda = !coach && !sample;
    const editor = it ? {
      exists: true, title: it.title, setTitle: e => A.upd('title', e.target.value), outcome: it.outcome, setOutcome: e => A.upd('outcome', e.target.value),
      types: TYPES.map(t => Object.assign({ label: t, on: it.type === t, pick: () => A.upd('type', t) }, sty('chip', it.type === t))),
      owners: s.members.map(m => Object.assign({ label: m.initials, name: m.name, on: it.owner === m.id, pick: () => A.upd('owner', m.id) }, sty('chip', it.owner === m.id))),
      minutes: it.minutes, inc: () => A.minutes(5), dec: () => A.minutes(-5),
      tasks: s.charter.tasks.map(t => Object.assign({ label: t.title, on: it.task === t.id, pick: () => A.upd('task', t.id) }, sty('chip', it.task === t.id))).concat([Object.assign({ label: 'None of our team tasks', on: !it.task, pick: () => A.upd('task', null) }, sty('chip', !it.task))]),
      flagged: itSt.flagged, canConfirm: itSt.flagged && leader && !sample, confirmed: !it.task && it.ok, confirm: A.confirmItem,
      ready: itSt.ready, state: itSt.flagged ? 'Flagged: matches no team task in the charter' : !itSt.complete ? 'Not ready: add ' + itSt.missing.join(', ') : 'Ready',
      remove: A.removeItem, canRemove: leader && !sample, canEdit: canEditAgenda, readOnly: !canEditAgenda
    } : { exists: false, types: [], owners: [], tasks: [] };
    const practicePrompt = type => { const p = PRACTICES.find(x => s.practices.includes(x.id) && x.types.includes(type)); return p ? { has: true, name: p.name, text: p.steps[0], focus: SC[p.scale].label } : { has: false, name: '', text: '', focus: '' }; };

    // live
    const LV = s.live; const cur = s.agenda[LV.idx] || s.agenda[0];
    const curP = cur ? person(cur.owner) : person(null);
    const curTask = cur ? s.charter.tasks.find(t => t.id === cur.task) : null;
    const nextIt = s.agenda[LV.idx + 1];
    const OL = { reached: 'Reached', carried: 'Carried over', parked: 'Parked' };
    const live = {
      notStarted: !LV.started, running: LV.started && !LV.ended, ended: LV.ended, isRunning: LV.running, isPaused: !LV.running,
      list: s.agenda.map((x, k) => { const o = LV.outcomes[x.id]; const isCur = k === LV.idx && LV.started && !LV.ended; return Object.assign({ n: k + 1, title: x.title, type: x.type || 'No type', minutes: x.minutes, done: !!o, status: o ? OL[o] : isCur ? 'Now' : '', cur: isCur, upcoming: !o && !isCur, flagged: itemState(s, x).flagged }, sty('card', isCur)); }),
      closedCount: Object.keys(LV.outcomes).length, total: s.agenda.length, progress: (Object.keys(LV.outcomes).length / Math.max(1, s.agenda.length) * 100).toFixed(1) + '%',
      totalMin: s.agenda.reduce((a, x) => a + x.minutes, 0),
      cur: cur ? { n: LV.idx + 1, title: cur.title, type: cur.type || 'No type', outcome: cur.outcome || 'No desired outcome was set', owner: curP.name, initials: curP.initials, abg: curP.abg, afg: curP.afg, minutes: cur.minutes, boxText: mmss(cur.minutes * 60), task: curTask ? curTask.title : 'No team task', fits: !!curTask } : {},
      timeText: mmss(LV.secs), pct: cur ? Math.min(100, (1 - LV.secs / (cur.minutes * 60)) * 100).toFixed(1) + '%' : '0%', over: LV.started && LV.secs === 0,
      toggleRun: A.toggleRun, runLabel: LV.running ? 'Pause' : 'Resume', runIcon: LV.running ? 'lucide:pause' : 'lucide:play', plus5: A.plus5,
      comments: LV.comments.slice(0, 4).map(c => ({ text: c.text, when: rel(c.t) + ' · item ' + c.item })), hasComments: LV.comments.length > 0, noComments: LV.comments.length === 0,
      canComment: LV.online >= 4, cannotComment: LV.online < 4, commentOp: LV.online >= 4 ? '1' : '0.4',
      commentNote: LV.online >= 4 ? 'Anonymous. ' + LV.online + ' online.' : 'Needs 4 or more online. ' + LV.online + ' online now.',
      ask: () => A.comment('What are we trying to achieve?'), off: () => A.comment('We are off track'),
      online: LV.online, incOnline: () => A.online(1), decOnline: () => A.online(-1),
      decision: cur ? (LV.decisions[cur.id] || '') : '', setDecision: e => A.setDecision(e.target.value),
      actions: cur ? LV.actions.filter(a => a.item === cur.id).map(a => Object.assign({ text: a.text, due: a.due }, (() => { const p = person(a.owner); return { owner: p.name, initials: p.initials, abg: p.abg, afg: p.afg }; })())) : [],
      na: LV.na || '', setNa: e => A.setLiveNa(e.target.value), addAction: A.addLiveAction, canWrite: !coach,
      close: [['reached', 'Reached'], ['carried', 'Carry over'], ['parked', 'Park']].map(([k, l], j) => Object.assign({ label: l, pick: () => A.closeItem(k), primary: j === 0, secondary: j > 0 }, sty('opt', j === 0))),
      canControl: leader, cannotControl: !leader, controlNote: coach ? 'Coaches follow along. The leader runs the meeting.' : 'The team leader moves the meeting forward.',
      nextText: nextIt ? 'Next · ' + nextIt.title + ' · ' + (nextIt.type || 'No type') + ' · ' + nextIt.minutes + ' min' : 'This is the last item',
      prompt: practicePrompt(cur ? cur.type : ''),
      summary: {
        reached: Object.values(LV.outcomes).filter(x => x === 'reached').length, carried: Object.values(LV.outcomes).filter(x => x === 'carried').length, parked: Object.values(LV.outcomes).filter(x => x === 'parked').length,
        decisions: s.agenda.filter(x => (LV.decisions[x.id] || '').trim()).map(x => ({ title: x.title, text: LV.decisions[x.id] })),
        actions: LV.actions.map(a => ({ text: a.text, owner: person(a.owner).name, due: a.due })),
        items: s.agenda.map(x => ({ title: x.title, status: OL[LV.outcomes[x.id]] || 'Not reached' }))
      },
      start: A.startMeeting, end: A.endMeeting, restart: A.resetMeeting, canStart: leader && !sample && s.agenda.length > 0, cannotStart: !(leader && !sample),
      startNote: sample ? 'Live meetings come with the Team plan.' : coach ? 'The leader starts the meeting. You can follow along.' : member ? 'Waiting for Kari to start the meeting.' : 'Everyone in the group sees the same screen, synced live.'
    };
    live.summary.hasDecisions = live.summary.decisions.length > 0; live.summary.noDecisions = !live.summary.hasDecisions;
    live.summary.hasActions = live.summary.actions.length > 0; live.summary.noActions = !live.summary.hasActions;
    live.hasActions = live.actions.length > 0;

    const meetings = {
      tabs: [['agenda', 'Agenda'], ['live', 'Live meeting']].map(([id, l]) => Object.assign({ label: l, on: s.meetTab === id, pick: () => A.set({ meetTab: id }), dot: id === 'live' && LV.started && !LV.ended }, sty('tab', s.meetTab === id))),
      items: ag, readyCount, total: ag.length, totalMin: s.agenda.reduce((a, x) => a + x.minutes, 0), readyPct: (readyCount / Math.max(1, ag.length) * 100).toFixed(1) + '%',
      notReadyCount: ag.filter(x => x.notReady).length, flaggedCount: ag.filter(x => x.flagged).length,
      e: editor, add: A.addItem, canAdd: canEditAgenda, fitOff: s.charter.tasks.length === 0,
      title: 'Thursday leadership meeting', when: 'Thu 8 Oct · 09:00', live,
      openActions: s.actions.filter(a => !a.done).slice(0, 3).map(a => { const p = person(a.owner); return { text: a.text, owner: p.first, initials: p.initials, abg: p.abg, afg: p.afg, due: a.due }; })
    };

    // home
    const fcs = s.focus.map(id => SC[id]);
    const ser = fcs.map(x => series(x.id));
    const home = {
      greeting: (coach ? 'Hello, ' : 'Good morning, ') + me.first, free, paid,
      focus: fcs.map((sc, k) => ({ n: k + 1, label: sc.label, level: fmt(sc.r2), change: Math.abs(sc.r2 - sc.r1) >= 0.29 ? (sc.r2 > sc.r1 ? '+' : '−') + fmt(Math.abs(sc.r2 - sc.r1)) + ' since round 1' : 'Stable since round 1', agree: AG[sc.ag], pct: pct(sc.r2), open: () => A.openScale(sc.id) })),
      hasFocus: fcs.length > 0, noFocus: fcs.length === 0, oneFocus: fcs.length === 1, focusSlotOpen: fcs.length < 2,
      chooseFocus: () => A.set({ route: 'develop', devTab: 'focus' }),
      readyCount, total: ag.length, notReadyCount: ag.filter(x => x.notReady).length, flaggedCount: ag.filter(x => x.flagged).length,
      readyText: readyCount + ' of ' + ag.length,
      agenda: ag, goAgenda: () => A.set({ route: 'meetings', meetTab: 'agenda' }),
      actions: s.actions.filter(a => !a.done).slice(0, 4).map(a => { const p = person(a.owner); return { text: a.text, owner: p.first, initials: p.initials, abg: p.abg, afg: p.afg, due: a.due, toggle: () => A.toggleAction(a.id) }; }),
      openCount: s.actions.filter(a => !a.done).length, goActions: () => A.set({ route: 'develop', devTab: 'focus' }),
      pulse: { answered: s.pulse.answered, of: s.pulse.of, missing: s.pulse.of - s.pulse.answered, dots: Array.from({ length: s.pulse.of }, (_, k) => ({ bg: k < s.pulse.answered ? T.dotOn : T.dotOff })), pct: (s.pulse.answered / s.pulse.of * 100).toFixed(1) + '%' },
      trendA: fcs[0] ? fcs[0].label : 'No focus area', trendB: fcs[1] ? fcs[1].label : '', two: fcs.length > 1,
      trend: PULSE_LABELS.map((lab, k) => Object.assign({ label: lab, v1: ser[0] ? fmt(ser[0][k]) : '', v2: ser[1] ? fmt(ser[1][k]) : '', h1: ser[0] ? hpct(ser[0][k]) : '0%', h2: ser[1] ? hpct(ser[1][k]) : '0%', last: k === 6 }, sty('col', k === 6))),
      trendDelta: ser[0] ? (ser[0][6] - ser[0][0] >= 0 ? '+' : '−') + fmt(Math.abs(ser[0][6] - ser[0][0])) : '',
      scan: teamThemes, scanAnswered: answered, scanCap: cap, scanReady: answered >= 4, scanNotReady: answered < 4, scanNeeded: needed + ' more answer' + (needed === 1 ? '' : 's') + ' needed for the team view', goInvite: () => A.go('invite'), upsell: free && leader, ask: free && !leader,
      practice: s.practices.length ? PRACTICES.find(p => p.id === s.practices[0]) : null
    };
    home.practiceName = home.practice ? home.practice.name : 'No practice chosen';
    home.practiceText = home.practice ? home.practice.steps[0] : 'Pick a practice in Develop and it shows here as a reminder.';
    home.goPractices = () => A.set({ route: 'develop', devTab: 'practices' });

    // group
    const ch = s.charter, d = s.draft;
    const group = {
      tabs: [['charter', 'Charter'], ['members', 'Members']].map(([id, l]) => Object.assign({ label: l, on: s.groupTab === id, pick: () => A.set({ groupTab: id }) }, sty('tab', s.groupTab === id))),
      charterTab: s.groupTab === 'charter', membersTab: s.groupTab === 'members', tabLabel: s.groupTab === 'members' ? 'Members' : 'Charter',
      version: 'v' + ch.version, status: d ? 'Draft v' + (ch.version + 1) : 'v' + ch.version + ' in force', editing: !!d, viewing: !d,
      purpose: ch.purpose,
      tasks: ch.tasks.map(t => { const p = person(t.owner); return { title: t.title, right: t.right, owner: p.name, ownerRole: p.role, initials: p.initials, abg: p.abg, afg: p.afg, time: TASK_TIME[t.id] || 'New' }; }),
      agreements: ch.agreements.map((a, k) => ({ text: a, n: k + 1 })),
      taskCount: ch.tasks.length, agreementCount: ch.agreements.length,
      canEdit: leader && !sample && !d, cannotEdit: !(leader && !sample) && !d,
      lockReason: sample ? (leader ? 'Comes with the Team plan' : 'Ask your team leader to upgrade') : coach ? 'Coaches read the charter only' : 'Only the team leader edits the charter. You can comment in the next meeting.',
      startEdit: A.startEdit, cancelEdit: A.cancelEdit, agree: A.agree,
      draft: d ? {
        purpose: d.purpose, setPurpose: e => A.draftSet('purpose', e.target.value),
        tasks: d.tasks.map((t, k) => ({ title: t.title, setTitle: e => A.draftTask(k, 'title', e.target.value), rights: RIGHTS.map(rg => Object.assign({ label: rg, on: t.right === rg, pick: () => A.draftTask(k, 'right', rg) }, sty('chip', t.right === rg))), remove: () => A.removeTask(k) })),
        addTask: A.addTask,
        agreements: d.agreements.map((a, k) => ({ text: a, n: k + 1, setText: e => A.draftAgreement(k, e.target.value), remove: () => A.removeAgreement(k) })),
        addAgreement: A.addAgreement
      } : { purpose: '', tasks: [], agreements: [] },
      members: s.members.map(m => Object.assign({ id: m.id, name: m.name, role: m.role, initials: m.initials, leader: !!m.leader, tag: m.leader ? 'Team leader' : 'Member', canRemove: leader && !m.leader && !sample, remove: () => A.removeMember(m.id) }, av(m.tone))),
      count: s.members.length, toMembers: () => A.set({ groupTab: 'members' }), canManage: leader && !sample, cannotManage: !(leader && !sample),
      newMember: s.newMember, setNewMember: e => A.setNewMember(e.target.value), addMember: A.addMember, addOp: s.newMember.trim().length > 1 ? '1' : '0.45',
      coachAccess: s.coachAccess, coachText: s.coachAccess ? 'Anne Vik can see group-level results' : 'Coach access withdrawn', toggleCoach: A.toggleCoach, canToggleCoach: leader && !sample,
      toggleBg: s.coachAccess ? T.toggleOn : T.toggleOff, knob: s.coachAccess ? 'flex-end' : 'flex-start',
      sizeNote: 'Size is shown as a fact. The evidence on group size is mixed, so there is no target.',
      coach: Object.assign({ name: 'Anne Vik', initials: 'AV' }, av(5)), leaderP: person('kn')
    };

    // develop
    const full = s.focus.length >= 2;
    const adj = x => x.read === 'lower' ? 6 - x.r2 : x.r2;
    const pList = (s.pFilter === 'focus' ? PRACTICES.filter(p => s.focus.includes(p.scale)) : PRACTICES);
    const pSel = PRACTICES.find(p => p.id === s.pOpen) || pList[0] || PRACTICES[0];
    const develop = {
      tabs: [['focus', 'Focus areas and actions'], ['practices', 'Practices']].map(([id, l]) => Object.assign({ label: l, on: s.devTab === id, pick: () => A.set({ devTab: id }) }, sty('tab', s.devTab === id))),
      focusTab: s.devTab === 'focus', practicesTab: s.devTab === 'practices', canAct, readOnly: !canAct,
      slots: [0, 1].map(k => { const id = s.focus[k]; if (!id) return { n: k + 1, empty: true, filled: false, label: '', level: '', agree: '', ev: '', pct: '0%' }; const x = SC[id]; return { n: k + 1, empty: false, filled: true, label: x.label, level: fmt(x.r2), agree: AG[x.ag], ev: x.ev, evBg: evS(x.ev).bg, evFg: evS(x.ev).fg, pct: pct(x.r2), change: Math.abs(x.r2 - x.r1) >= 0.29 ? (x.r2 > x.r1 ? '+' : '−') + fmt(Math.abs(x.r2 - x.r1)) : 'Stable', remove: () => A.removeFocus(id), canRemove: canAct, open: () => A.openScale(id) }; }),
      full, focusCount: s.focus.length,
      candidates: SCALES.filter(x => x.layer !== 'outcomes' && x.read !== 'descriptive' && !s.focus.includes(x.id)).sort((a, b) => adj(a) - adj(b)).slice(0, 6).map(x => ({ label: x.label, level: fmt(x.r2), agree: AG[x.ag], ev: x.ev, evBg: evS(x.ev).bg, evFg: evS(x.ev).fg, sub: READ_NOTE[x.read] || '', add: () => A.addFocus(x.id), op: !full && canAct ? '1' : '0.45', open: () => A.openScale(x.id) })),
      actions: s.actions.map(a => { const p = person(a.owner); return { text: a.text, owner: p.name, first: p.first, initials: p.initials, abg: p.abg, afg: p.afg, due: a.due, done: a.done, open: !a.done, toggle: () => A.toggleAction(a.id), check: a.done ? 'lucide:check' : '' }; }),
      openCount: s.actions.filter(a => !a.done).length,
      na: {
        text: s.na.text, setText: e => A.setNa('text', e.target.value), due: s.na.due, setDue: e => A.setNa('due', e.target.value),
        owners: s.members.map(m => Object.assign({ label: m.initials, name: m.name, on: s.na.owner === m.id, pick: () => A.setNa('owner', m.id) }, sty('chip', s.na.owner === m.id))),
        save: A.saveAction, op: s.na.text.trim() && s.na.owner ? '1' : '0.45', needOwner: !!s.na.text.trim() && !s.na.owner, ownerName: s.na.owner ? person(s.na.owner).name : 'Pick an owner'
      },
      filters: [['focus', 'For our focus areas'], ['all', 'All practices']].map(([id, l]) => Object.assign({ label: l, on: s.pFilter === id, pick: () => A.set({ pFilter: id }) }, sty('chip', s.pFilter === id))),
      practices: pList.map(p => { const x = SC[p.scale]; const on = s.practices.includes(p.id); return Object.assign({ id: p.id, name: p.name, scale: x.label, ev: x.ev, evBg: evS(x.ev).bg, evFg: evS(x.ev).fg, format: p.format, inUse: on, open: () => A.set({ pOpen: p.id }), sel: pSel.id === p.id }, sty('card', pSel.id === p.id)); }),
      noPractices: pList.length === 0,
      p: { id: pSel.id, name: pSel.name, scale: SC[pSel.scale].label, ev: SC[pSel.scale].ev, evBg: evS(SC[pSel.scale].ev).bg, evFg: evS(SC[pSel.scale].ev).fg, format: pSel.format, steps: pSel.steps.map((t, k) => ({ n: k + 1, text: t })), inUse: s.practices.includes(pSel.id), toggle: () => A.togglePractice(pSel.id), useLabel: s.practices.includes(pSel.id) ? 'In use · remove' : 'Use in our meetings', where: pSel.types.length ? 'Shows as a prompt on ' + pSel.types.map(t => t.toLowerCase()).join(' and ') + ' items. Use it in your next leadership meeting.' : 'Run it as a separate session with the group. It shows on Home as a reminder.' },
      inUseCount: s.practices.length,
      mixedNote: 'Size and composition are rated mixed, so no practice is offered for them.'
    };

    // me
    const w = member ? 'member' : 'leader';
    const pr = PROFILES[w];
    const done = s.profileDone[w];
    const shareK = s.share[w];
    const others = 3;
    const mapCount = others + (shareK !== 'nothing' && done ? 1 : 0);
    const meV = {
      name: me.name, done, notDone: !done, take: A.takeProfile, test: pr.test,
      domains: DOMAINS.map((dn, k) => ({ n: '0' + (k + 1), label: dn, desc: pr.desc[k], pos: pr.pos[k] + '%', band: band(pr.pos[k]), expanded: k === 1 })),
      facets: FACETS.map((f, k) => ({ label: f, pos: pr.facets[k] + '%', band: band(pr.facets[k]) })),
      share: [['nothing', 'Nothing', 'Your profile shows as Not shared.'], ['domains', 'Domains', 'Five domain positions. No facets.'], ['facets', 'Domains and facets', 'All five domains and 30 facets.']].map(([k, l, ds]) => Object.assign({ label: l, desc: ds, on: shareK === k, pick: () => A.setShare(k), mark: shareK === k ? 'lucide:circle-dot' : 'lucide:circle' }, sty('opt', shareK === k))),
      shareLabel: { nothing: 'Nothing', domains: 'Domains', facets: 'Domains and facets' }[shareK],
      locked: !done, mapCount, mapOpen: mapCount >= 3, mapClosed: mapCount < 3,
      mapText: mapCount >= 3 ? 'The team map is open. It shows only the ' + mapCount + ' who share.' : 'The team map opens when 3 members share.',
      prompt: pr.prompt,
      modules: MODULES.map(m => ({ id: m.id, name: m.name, items: m.items, added: s.modules[w].includes(m.id), notAdded: !s.modules[w].includes(m.id), add: () => A.openConsent(m.id), remove: () => A.removeModule(m.id), op: paid ? '1' : '0.45' })),
      modulesFree: free, modulesPaid: paid,
      consent: { open: !!s.consent, name: s.consent ? (MODULES.find(m => m.id === s.consent) || {}).name : '', ok: s.consentOk, toggle: A.consentToggle, accept: A.consentAccept, cancel: A.consentCancel, op: s.consentOk ? '1' : '0.45', box: s.consentOk ? 'lucide:square-check' : 'lucide:square' }
    };


    // v2: layout, people, assessments
    const ui = { vertical: s.ui.nav === 'vertical', horizontal: s.ui.nav !== 'vertical', wide: s.ui.wide, maxW: s.ui.wide ? '100%' : (T.maxW || '1240px'),
      toggleNav: A.toggleNav, toggleWide: A.toggleWide, navIcon: s.ui.nav === 'vertical' ? 'lucide:panel-top' : 'lucide:panel-left', wideIcon: s.ui.wide ? 'lucide:minimize-2' : 'lucide:maximize-2',
      navLabel: s.ui.nav === 'vertical' ? 'Switch to a horizontal menu' : 'Switch to a vertical menu', wideLabel: s.ui.wide ? 'Contain the page' : 'Extend to full width' };
    const SHARE_L = { nothing: 'Not shared', domains: 'Domains', facets: 'Domains and facets' };
    const shareOf = id => id === 'kn' ? (s.profileDone.leader ? s.share.leader : 'nothing') : id === 'lj' ? (s.profileDone.member ? s.share.member : 'nothing') : ((PEOPLE[id] || {}).share || 'nothing');
    const posOf = id => id === 'kn' ? (s.lpScores.leader || PROFILES.leader.pos) : id === 'lj' ? (s.lpScores.member || PROFILES.member.pos) : (PEOPLE[id] || {}).pos;
    const facetsOf = id => id === 'kn' ? PROFILES.leader.facets : id === 'lj' ? PROFILES.member.facets : ((PEOPLE[id] || {}).facets || [50, 50, 50, 50, 50, 50]);
    const cvOf = id => { const c = (PEOPLE[id] || {}).cv || { opt: false, raters: 0, scores: [] }; const opt = id === 'kn' ? s.cv.optIn.leader : id === 'lj' ? s.cv.optIn.member : c.opt; const shared = id === 'kn' ? s.cv.shared.leader : id === 'lj' ? s.cv.shared.member : !!c.shared; return Object.assign({ self: [] }, c, { opt: !!opt && s.cv.group, shared }); };
    const stOf = id => (PEOPLE[id] || {}).status || 'invited';
    const stS = st => st === 'invited' ? (T.pending || { bg: '#fff4d6', fg: '#6b5208' }) : (T.active || { bg: '#e6f2ea', fg: '#22603a' });
    const roster = s.members.map(m => { const P = PEOPLE[m.id] || {}; const st = stOf(m.id); const sh = shareOf(m.id); const cv = cvOf(m.id); const own = s.actions.filter(a => a.owner === m.id);
      return Object.assign({ id: m.id, name: m.name, role: m.role, unit: P.unit || m.role, initials: m.initials, tag: m.leader ? 'Team leader' : 'Member', status: st === 'invited' ? 'Invited' : 'Active', statusBg: stS(st).bg, statusFg: stS(st).fg, since: P.since || 'Invited today', share: SHARE_L[sh], cvLabel: cv.opt ? 'Opted in' : 'Not opted in', tasks: s.charter.tasks.filter(t => t.owner === m.id).length, openA: own.filter(a => !a.done).length, doneA: own.filter(a => a.done).length, isMe: m.id === me.id, open: () => A.openPerson(m.id) }, av(m.tone)); });
    const sharers = s.members.filter(m => shareOf(m.id) !== 'nothing' && posOf(m.id));
    const tmap = { open: sharers.length >= 3, closed: sharers.length < 3, count: sharers.length, total: s.members.length,
      domains: DOMAINS.map((dn, k) => ({ label: dn, dots: sharers.map(m => Object.assign({ initials: m.initials, name: m.name, pos: posOf(m.id)[k] + '%' }, av(m.tone))) })),
      people: sharers.map(m => Object.assign({ name: m.name, initials: m.initials, share: SHARE_L[shareOf(m.id)] }, av(m.tone))) };
    const pid = s.members.find(m => m.id === s.person) ? s.person : s.members[0].id;
    const pm = mem(pid), PP = PEOPLE[pid] || {}, pst = stOf(pid);
    const psh = shareOf(pid), ppos = posOf(pid), pcv = cvOf(pid), isMeP = pid === me.id;
    const pown = s.actions.filter(a => a.owner === pid);
    const pidx = s.members.findIndex(m => m.id === pid);
    const topK = ppos ? ppos.indexOf(Math.max.apply(null, ppos)) : 0;
    const cvEnough = pcv.opt && (pcv.raters || 0) >= 4;
    const tlfEnough = s.tlf.raters >= 4;
    const tlfVis = pid === 'kn' && tlfEnough && (me.id === 'kn' || s.tlf.shared);
    const gapRow = TLF.slice().sort((a, b) => Math.abs(b[1] - b[2]) - Math.abs(a[1] - a[2]))[0];
    const pdet = {
      id: pid, name: pm.name, first: pm.name.split(' ')[0], role: pm.role, unit: PP.unit || pm.role, initials: pm.initials, abg: av(pm.tone).abg, afg: av(pm.tone).afg,
      tag: pm.leader ? 'Team leader' : 'Member', status: pst === 'invited' ? 'Invited' : 'Active', statusBg: stS(pst).bg, statusFg: stS(pst).fg, invited: pst === 'invited', since: PP.since || 'Invited today', isMe: isMeP, notMe: !isMeP,
      tasks: s.charter.tasks.filter(t => t.owner === pid).map(t => ({ title: t.title, right: t.right, time: TASK_TIME[t.id] || 'New' })),
      actions: pown.map(a => ({ text: a.text, due: a.due, state: a.done ? 'Done' : 'Due ' + a.due, icon: a.done ? 'lucide:circle-check' : 'lucide:circle' })),
      taskCount: s.charter.tasks.filter(t => t.owner === pid).length, openA: pown.filter(a => !a.done).length, doneA: pown.filter(a => a.done).length,
      noTasks: s.charter.tasks.filter(t => t.owner === pid).length === 0, noActions: pown.length === 0,
      shareLabel: SHARE_L[psh], shared: psh !== 'nothing' && !!ppos, notShared: !(psh !== 'nothing' && !!ppos), facetsShared: psh === 'facets' && !!ppos,
      domains: ppos ? DOMAINS.map((dn, k) => ({ label: dn, pos: ppos[k] + '%', band: band(ppos[k]) })) : [],
      facets: FACETS.map((f, k) => ({ label: f, pos: facetsOf(pid)[k] + '%', band: band(facetsOf(pid)[k]) })),
      prompt: ppos ? pm.name.split(' ')[0] + ' sits ' + band(ppos[topK]).toLowerCase() + ' on ' + DOMAINS[topK] + '. Ask the group: ' + PROMPTQ[topK] : '',
      cv: { notOpt: !pcv.opt, few: pcv.opt && (pcv.raters || 0) < 4, raters: pcv.raters || 0, visible: cvEnough && (isMeP || pcv.shared), hidden: cvEnough && !isMeP && !pcv.shared, showSelf: isMeP, canShare: isMeP && cvEnough, shareLabel: pcv.shared ? 'Shared with the group · stop sharing' : 'Share a summary with the group',
        toggleShare: A.toggleCvShare, sharedNote: pcv.shared ? (isMeP ? 'You share this summary with the group.' : pm.name.split(' ')[0] + ' chose to share this summary.') : 'Only you see this. You choose what to share.',
        rows: CONTRIB.map((l, k) => ({ label: l, avg: pcv.scores && pcv.scores[k] != null ? fmt(pcv.scores[k]) : '', pct: pcv.scores && pcv.scores[k] != null ? pct(pcv.scores[k]) : '0%', self: pcv.self && pcv.self[k] != null ? fmt(pcv.self[k]) : '–', selfPct: pcv.self && pcv.self[k] != null ? pct(pcv.self[k]) : '0%' })) },
      isLeaderP: pid === 'kn', tlf: { visible: tlfVis, hidden: pid === 'kn' && !tlfVis, raters: s.tlf.raters, canShare: pid === 'kn' && me.id === 'kn' && tlfEnough, shareLabel: s.tlf.shared ? 'Shared with the group · stop sharing' : 'Share the averages with the group', toggleShare: A.toggleTlfShare,
        hiddenText: !tlfEnough ? 'Results need 4 raters besides the leader. ' + s.tlf.raters + ' so far.' : 'Kari sees these averages first and has not shared them.',
        pick: 'Biggest gap: ' + gapRow[0].toLowerCase() + ' (group ' + fmt(gapRow[1]) + ', self ' + fmt(gapRow[2]) + '). Pick one thing to change.',
        rows: TLF.map(([l, a, sf]) => ({ label: l, avg: fmt(a), pct: pct(a), self: fmt(sf), selfPct: pct(sf), gap: Math.abs(a - sf) >= 0.5 })) },
      prev: () => A.openPerson(s.members[(pidx - 1 + s.members.length) % s.members.length].id), next: () => A.openPerson(s.members[(pidx + 1) % s.members.length].id),
      back: () => A.set({ peopleTab: 'roster' }), canResend: leader && pst === 'invited', resend: () => A.toastMsg('Invitation sent again to ' + pm.name),
      canRemove: leader && !pm.leader && !sample, remove: () => { A.removeMember(pid); A.set({ peopleTab: 'roster' }); }
    };
    const people = {
      tabs: [['roster', 'Team'], ['map', 'Team map']].map(([id, l]) => { const on = s.peopleTab === id || (id === 'roster' && s.peopleTab === 'person'); return Object.assign({ label: l, on, pick: () => A.set({ peopleTab: id }) }, sty('tab', on)); }),
      rosterTab: s.peopleTab === 'roster', mapTab: s.peopleTab === 'map', personTab: s.peopleTab === 'person',
      roster, active: roster.filter(x => x.status === 'Active').length, invitedN: roster.filter(x => x.status === 'Invited').length, sharing: sharers.length, optedIn: s.members.filter(m => cvOf(m.id).opt).length, total: s.members.length,
      map: tmap, p: pdet, note: 'Development only. No ranking view exists, and nobody sees who answered what.'
    };
    const SD = s.sched, PC = s.pcfg;
    const startIdx = Math.max(0, MONTHS.indexOf(SD.start));
    const diagIdx = []; for (let k = startIdx; k < 12; k += SD.rhythm) diagIdx.push(k);
    const pulseCount = Array(12).fill(0); pulseCount[0] = 1;
    for (let k = 0; k < 60; k++) { const mi = 1 + Math.floor(k * PC.weeks / 4.345); if (mi > 11) break; pulseCount[mi]++; }
    const r3m = MONTHS[startIdx], r3y = startIdx < 3 ? 2026 : 2027;
    const comp = [];
    s.focus.forEach(id => (ITEMS[id] || []).forEach(t => comp.push({ text: t, src: 'Focus · ' + SC[id].label, k: 'evStrong' })));
    if (PC.agreements) s.charter.agreements.forEach(a => comp.push({ text: 'In the last ' + PC.weeks + ' weeks we kept to this: ' + a, src: 'Working agreement', k: 'evModerate' }));
    ROTATING.slice(0, PC.rotating).forEach(t => comp.push({ text: t, src: 'Rotating', k: 'evOther' }));
    const used = comp.slice(0, 10), over = comp.length - used.length;
    const canGov = leader && !sample;
    const toggleS = on => ({ tbg: on ? T.toggleOn : T.toggleOff, knob: on ? 'flex-end' : 'flex-start' });
    const assess = {
      tabs: [['schedule', 'Schedule'], ['pulse', 'Pulse setup'], ['tests', 'Individual tests']].map(([id, l]) => Object.assign({ label: l, on: s.assessTab === id, pick: () => A.set({ assessTab: id }) }, sty('tab', s.assessTab === id))),
      scheduleTab: s.assessTab === 'schedule', pulseTab: s.assessTab === 'pulse', testsTab: s.assessTab === 'tests', canGov, readOnly: !canGov,
      lockText: sample ? 'Sample. Scheduling and pulse setup come with the Team plan.' : coach ? 'Coaches see the schedule. The team leader changes it.' : 'Read only. The team leader changes the schedule and the pulse setup.',
      months: MONTHS.map((mo, k) => ({ label: mo, year: k < 3 ? '2026' : '2027', diag: diagIdx.includes(k), diagLabel: 'R' + (3 + Math.max(0, diagIdx.indexOf(k))), pulses: Array.from({ length: pulseCount[k] }, () => ({ x: 1 })), refl: k % 3 === 2, now: k === 0, nowBg: k === 0 ? (T.opt.on.bg) : 'transparent' })),
      rhythm: SD.rhythm, window: SD.window, incRhythm: () => A.rhythm(1), decRhythm: () => A.rhythm(-1), incWindow: () => A.windowDays(1), decWindow: () => A.windowDays(-1),
      starts: ['Jan', 'Feb', 'Mar', 'Apr'].map(mo => Object.assign({ label: mo + ' 2027', on: SD.start === mo, pick: () => A.setSched('start', mo) }, sty('chip', SD.start === mo))),
      reminders: [1, 2, 3, 5, 7, 10, 12, 14, 21, 28].filter(d => d < SD.window).map(d => Object.assign({ label: 'Day ' + d, on: SD.reminders.includes(d), pick: () => A.toggleReminder(d) }, sty('chip', SD.reminders.includes(d)))),
      remText: SD.reminders.filter(d => d < SD.window).sort((a, b) => a - b).map(d => 'day ' + d).join(', ') || 'no reminders',
      release: [['session', 'At the results session', 'Or 48 hours after close if no session is held'], ['auto', 'At close', 'All members get access at the same moment']].map(([k, l, d]) => Object.assign({ label: l, desc: d, on: SD.release === k, pick: () => A.setSched('release', k), mark: SD.release === k ? 'lucide:circle-dot' : 'lucide:circle' }, sty('opt', SD.release === k))),
      toggleOutside: A.toggleOutside,
      r3: { opens: '1 ' + r3m + ' ' + r3y, closes: (1 + SD.window) + ' ' + r3m + ' ' + r3y, planned: SD.r3 === 'planned', open: SD.r3 === 'open', closed: SD.r3 === 'closed', answered: SD.r3answered, of: s.members.length, pct: (SD.r3answered / s.members.length * 100).toFixed(1) + '%', status: { planned: 'Planned', open: 'Open', closed: 'Closed' }[SD.r3], openNow: A.openRound3, simulate: A.simRound3, canOpen: canGov && SD.r3 === 'planned' },
      p: {
        weeks: PC.weeks, perYear: Math.round(52 / PC.weeks), next: NEXTP[PC.weeks], incWeeks: () => A.pweeks(1), decWeeks: () => A.pweeks(-1), windowDays: PC.windowDays, incWin: () => A.pwin(1), decWin: () => A.pwin(-1),
        items: used.map((x, k) => ({ n: k + 1, text: x.text, src: x.src, sbg: (T[x.k] || T.evOther).bg, sfg: (T[x.k] || T.evOther).fg })), count: used.length, overflow: over > 0, overflowText: over + ' agreement item' + (over === 1 ? '' : 's') + ' rotate into the next pulse',
        minutes: Math.max(1, Math.round(used.length * 13 / 60)), noFocus: s.focus.length === 0,
        rot: [0, 1, 2].map(n => Object.assign({ label: String(n), on: PC.rotating === n, pick: () => A.prot(n) }, sty('chip', PC.rotating === n))),
        agreements: PC.agreements, toggleAgreements: A.pagree, ag: toggleS(PC.agreements),
        history: PULSES.map(([n, d, a]) => ({ n, date: d, answered: a + ' of 8', result: a >= 4 ? 'Result' : 'Missed · fewer than 4', missed: a < 4 })).concat([{ n: 6, date: '28 Sep', answered: s.pulse.answered + ' of ' + s.pulse.of, result: 'Open · closes Wed', missed: false }]).reverse(),
        rules: [['Who changes it', 'The team leader. Members see the setup and the reasons for it.'], ['Anonymity', 'Results need 4 answers. Lumio AS sets this for all groups. It can be raised, never lowered.'], ['Trend margin', 'A change shows only at 0.3 scale points or more. Smaller changes read as stable.'], ['Missed pulses', 'Fewer than 4 answers gives no result. The pulse is logged as missed.'], ['Reminders', 'Sent only to people who have not answered. Nobody sees who they are.'], ['Data', 'Answers carry no person ID. Kept while the plan is active, plus 90 days.']].map(([t, x]) => ({ title: t, text: x }))
      },
      t: {
        lpDone: s.profileDone[w], lpNotDone: !s.profileDone[w], lpStatus: s.profileDone[w] ? 'Completed' : 'Not started', lpTest: pr.test, sharers: sharers.length, goMe: () => A.go('me'), take: A.takeProfile, notCoach: !coach,
        tlfOpen: s.tlf.status === 'open', tlfClosed: s.tlf.status !== 'open', tlfStatus: s.tlf.status === 'open' ? 'Open · 14 days' : 'Closed', tlfRaters: s.tlf.raters, tlfOf: s.members.length - 1, tlfPct: (s.tlf.raters / Math.max(1, s.members.length - 1) * 100).toFixed(1) + '%',
        tlfLeader: leader, tlfMember: member, rated: s.tlf.ratedMember, notRated: !s.tlf.ratedMember && s.tlf.status === 'open', ratedOrClosed: s.tlf.ratedMember || s.tlf.status !== 'open',
        rate: A.rateLeader, openTlf: A.openTlf, simTlf: A.simTlf, closeTlf: A.closeTlf, viewTlf: () => A.openPerson('kn'), tlfEnough, tlfShort: !tlfEnough,
        cvGroup: s.cv.group, toggleCvGroup: A.toggleCvGroup, cvg: toggleS(s.cv.group), myOpt: (member ? s.cv.optIn.member : s.cv.optIn.leader), toggleMine: A.toggleCvOpt, cvm: toggleS(member ? s.cv.optIn.member : s.cv.optIn.leader),
        optedIn: s.members.filter(m => cvOf(m.id).opt).length, total: s.members.length, myPage: () => A.openPerson(me.id), rateOthers: () => A.toastMsg('The rating form has 8 items and 2 optional prompts per person.'), cvOn: s.cv.group && !coach, cvOff: !s.cv.group
      }
    };
    home.upcoming = [
      { icon: 'lucide:activity', title: 'Pulse 6 closes Wednesday', meta: s.pulse.answered + ' of ' + s.pulse.of + ' answered', go: () => A.set({ route: 'assess', assessTab: 'pulse' }) },
      { icon: 'lucide:activity', title: 'Pulse 7 opens ' + NEXTP[PC.weeks], meta: used.length + ' items · every ' + PC.weeks + ' weeks', go: () => A.set({ route: 'assess', assessTab: 'pulse' }) },
      { icon: 'lucide:clipboard-check', title: 'Round 3 · extensive diagnostic', meta: (PHN[(s.rounds.find(x => x.id === 'r3') || {}).status] || 'Not scheduled') + ' · opens ' + ((s.rounds.find(x => x.id === 'r3') || {}).opens || '–'), go: () => A.set({ route: 'assess', assessTab: 'overview' }) },
      { icon: 'lucide:message-square', title: 'Team-leader feedback', meta: (s.tlf.status === 'open' ? 'Open · ' : 'Closed · ') + s.tlf.raters + ' raters', go: () => A.set({ route: 'assess', assessTab: 'tests' }) },
      { icon: 'lucide:refresh-ccw', title: 'Reflection session', meta: 'December · every quarter', go: () => A.set({ route: 'assess', assessTab: 'schedule' }) }
    ];
    home.nextDate = NEXTP[PC.weeks]; home.nextItems = used.length; home.goSchedule = () => A.set({ route: 'assess', assessTab: 'schedule' }); home.goPulse = () => A.set({ route: 'assess', assessTab: 'pulse' });
    meV.myPage = () => A.openPerson(me.id); meV.goTests = () => A.set({ route: 'assess', assessTab: 'tests' });
    // v3: assessments in depth
    const ink = T.ink || '#16131f', muted = T.muted || '#7a7488';
    const stepsFor = rd => { const pi = rd.status === 'missed' ? 3 : Math.max(0, PH_IDS.indexOf(rd.status)); const dt = [rd.notice ? 'Notice ' + rd.notice : '', (rd.opens || '') + (rd.closes ? ' – ' + rd.closes : ''), pi >= 2 ? rd.answered + ' of ' + rd.of + ' answered' : '', rd.status === 'missed' ? 'No result' : (rd.released || ''), rd.session || '', rd.follow || ''];
      return PHASES.map((p, k) => ({ label: p[1], date: dt[k], text: p[2], bar: k < pi ? T.stepDone : k === pi ? T.stepCur : T.dotOff, fg: k <= pi ? ink : muted })); };
    const nextAct = { scheduled: 'Open now', open: 'Close now', closed: 'Release results', released: 'Mark session held', session: 'Start follow-up' };
    const isDiag = t => t === 'std' || t === 'ext';
    const roundV = rd => { const c = CATM[rd.type] || {}; const isOpen = rd.status === 'open'; const n = rd.answered; const mineDone = rd.type === 'tlf' ? (member ? s.tlf.ratedMember : !!s.tlf.selfDone) : !!rd.mine;
      return { id: rd.id, label: rd.label, name: c.name, level: c.level, icon: c.icon, opens: rd.opens, closes: rd.closes, status: PHN[rd.status] || rd.status, answered: n, of: rd.of, pct: (n / Math.max(1, rd.of) * 100).toFixed(1) + '%', isOpen,
        thr: isOpen ? (n >= 4 ? 'Result guaranteed · 4 or more have answered' : (4 - n) + ' more needed for a result') : rd.status === 'scheduled' ? 'Members get a notice 7 days before it opens' : rd.status === 'missed' ? 'No result · fewer than 4 answered' : n + ' of ' + rd.of + ' answered',
        steps: stepsFor(rd), canAnswer: isOpen && !mineDone && !coach && !sample && rd.type !== 'cv', answeredMe: isOpen && mineDone, answer: () => A.startRun(rd.type),
        nextLabel: nextAct[rd.status] || '', canAdvance: leader && !sample && !!nextAct[rd.status], advance: () => A.advanceRound(rd.id),
        canSim: isOpen && n < rd.of, sim: () => A.simRound(rd.id), canCancel: leader && !sample && rd.status === 'scheduled', cancel: () => A.cancelRound(rd.id),
        hasResults: isDiag(rd.type) && ['released', 'session', 'followup'].includes(rd.status), results: () => { A.setRes({ round: rd.id === 'r1' ? 1 : 2, depth: 'questions' }); A.go('results'); } }; };
    const ord = { open: 0, closed: 1, released: 2, session: 3, scheduled: 4, followup: 5, missed: 6 };
    const todos = [];
    if (!coach) {
      s.rounds.filter(x => x.status === 'open' && x.type !== 'tlf' && x.type !== 'cv' && !x.mine).forEach(x => todos.push({ icon: CATM[x.type].icon, title: 'Answer the ' + CATM[x.type].name.toLowerCase(), meta: x.label + ' · closes ' + x.closes + ' · about ' + CATM[x.type].min + ' min', cta: 'Answer now', go: () => A.startRun(x.type) }));
      if (!s.pulseMine && !free) todos.push({ icon: 'lucide:activity', title: 'Answer pulse 6', meta: 'Closes Wednesday · ' + pulseComp(s).length + ' items · about 2 min', cta: 'Answer now', go: () => A.startRun('pulse') });
      if (s.tlf.status === 'open' && member && !s.tlf.ratedMember) todos.push({ icon: 'lucide:message-square', title: 'Rate Kari as team leader', meta: '10 items · anonymous · about 4 min', cta: 'Rate', go: () => A.startRun('tlf') });
      if (s.tlf.status === 'open' && leader && !s.tlf.selfDone) todos.push({ icon: 'lucide:message-square', title: 'Rate yourself as team leader', meta: '10 items · shown next to the group average', cta: 'Rate', go: () => A.startRun('tlf') });
      const toRate = s.members.filter(m => m.id !== me.id && cvOf(m.id).opt && !s.cvRated.includes(m.id));
      if (s.cv.group && toRate.length && !free) todos.push({ icon: 'lucide:handshake', title: 'Rate ' + toRate.length + ' colleagues', meta: 'Contribution view · 8 items each', cta: 'Open', go: () => A.set({ route: 'assess', assessTab: 'tests' }) });
      if (!s.profileDone[w]) todos.push({ icon: 'lucide:user-round', title: 'Take the Leader Profile', meta: 'Quick · 20 items · private to you', cta: 'Start', go: () => A.startRun('lpq') });
    }
    const lastDiag = s.rounds.filter(x => isDiag(x.type) && ['released', 'session', 'followup'].includes(x.status)).slice(-1)[0];
    const nextDiag = s.rounds.filter(x => isDiag(x.type) && (x.status === 'scheduled' || x.status === 'open'))[0];
    const nextTlf = s.rounds.filter(x => x.type === 'tlf' && x.status === 'scheduled')[0];
    const firstSched = s.rounds.filter(x => x.status === 'scheduled')[0];
    assess.tabs = [['overview', 'Status'], ['library', 'Library'], ['schedule', 'Schedule'], ['pulse', 'Pulse setup'], ['tests', 'Individual']].map(([id, l]) => Object.assign({ label: l, on: s.assessTab === id, pick: () => A.set({ assessTab: id }) }, sty('tab', s.assessTab === id)));
    assess.overviewTab = s.assessTab === 'overview'; assess.libraryTab = s.assessTab === 'library';
    assess.o = {
      openCount: s.rounds.filter(x => x.status === 'open').length + 1, todoCount: todos.length, todos, noTodos: todos.length === 0,
      nextName: firstSched ? firstSched.label : 'Nothing scheduled', nextDate: firstSched ? CATM[firstSched.type].name + ' · ' + firstSched.opens : 'Use the Schedule tab',
      latest: lastDiag ? lastDiag.label : 'None yet', latestSub: lastDiag ? CATM[lastDiag.type].name + ' · released ' + (lastDiag.released || '') : '',
      rounds: s.rounds.slice().sort((a, b) => ord[a.status] - ord[b.status]).map(roundV),
      stand: LAYERS.map(([lid, ll]) => { const xs = SCALES.filter(x => x.layer === lid && x.read === 'higher'); const m2 = mean(xs.map(x => x.r2)), m1 = mean(xs.map(x => x.r1)), d = m2 - m1; return { label: ll, level: fmt(m2), pct: pct(m2), tick: pct(m1), change: Math.abs(d) >= 0.29 ? (d > 0 ? '+' : '−') + fmt(Math.abs(d)) : 'Stable', n: xs.length + ' scales' }; }),
      coverage: [
        ['Team diagnostic', lastDiag ? lastDiag.label + ' · ' + CATM[lastDiag.type].level + ' · ' + lastDiag.closes : 'None yet', nextDiag ? nextDiag.label + ' · ' + CATM[nextDiag.type].level + ' · ' + (nextDiag.status === 'open' ? 'open now' : nextDiag.opens) : 'Not scheduled'],
        ['Pulse', 'Pulse 6 · ' + s.pulse.answered + ' of ' + s.pulse.of + ' answered', 'Pulse 7 · ' + NEXTP[s.pcfg.weeks]],
        ['Team-leader feedback', (s.tlf.status === 'open' ? 'Open · ' : 'Sep 2026 · ') + s.tlf.raters + ' raters', nextTlf ? nextTlf.label + ' · ' + nextTlf.opens : (s.tlf.status === 'open' ? 'Open now' : 'Not scheduled')],
        ['Contribution view', s.members.filter(m => cvOf(m.id).opt).length + ' of ' + s.members.length + ' opted in', s.cv.group ? 'Ongoing' : 'Turned off'],
        ['Leader Profiles', sharers.length + ' of ' + s.members.length + ' share', tmap.open ? 'Team map open' : 'Map opens at 3'],
        ['Outside view', 'Not run', 'Organisation plan']
      ].map(([label, last, next]) => ({ label, last, next }))
    };
    const libDef = CATM[s.libSel] || CAT[1];
    const libRun = libDef.id === 'scan' ? { secs: THEMES.map((t, ti) => ({ title: t.label, sub: '', items: SCAN.filter(q => q[1] === ti).map(q => ({ text: q[0], tag: '' })) })), opts: OPTS } : buildRun(s, libDef.id, null, true);
    const libTotal = libRun.secs.reduce((a, x) => a + x.items.length, 0);
    assess.lib = {
      cards: CAT.map(c => Object.assign({ id: c.id, name: c.name, kind: c.kind, level: c.level, items: c.id === 'pulse' ? pulseComp(s).length : c.items, min: c.min, icon: c.icon, open: () => A.set({ libSel: c.id, libSec: 0 }) }, sty('card', s.libSel === c.id))),
      d: { name: libDef.name, kind: libDef.kind, level: libDef.level, icon: libDef.icon, purpose: libDef.purpose, items: libDef.id === 'pulse' ? pulseComp(s).length : libDef.items, min: libDef.min, who: libDef.who, freq: libDef.freq, output: libDef.output, anon: libDef.anon, listed: libTotal,
        phases: (isDiag(libDef.id) ? PHASES.map(p => [p[1], p[2]]) : IND_PHASES[libDef.id]).map((p, k) => ({ n: k + 1, label: p[0], text: p[1] })),
        secs: libRun.secs.map((sec, k) => ({ title: sec.title, sub: sec.sub || '', hasSub: !!sec.sub, count: sec.items.length, open: s.libSec === k, chev: s.libSec === k ? 'lucide:chevron-up' : 'lucide:chevron-down', toggle: () => A.set({ libSec: s.libSec === k ? -1 : k }), items: sec.items.map((it, j) => ({ n: j + 1, text: it.text, tag: it.tag || '', hasTag: !!it.tag })) })),
        scale: (libRun.opts || []).join(' · '), note: libDef.id === 'lpf' ? 'Listed here: one sample item per facet (30). The live test has 4 items per facet, 120 in total.' : libDef.id === 'ext' ? '74 items for members. The 6 outside-rater items are answered by people outside the group.' : '', hasNote: libDef.id === 'lpf' || libDef.id === 'ext',
        run: () => libDef.id === 'scan' ? A.startScan() : A.startRun(libDef.id), runLabel: libDef.id === 'scan' ? 'Open the Team Scan' : 'Preview or run', canSchedule: ['std', 'ext', 'pulse', 'tlf', 'cv'].includes(libDef.id) && canGov, schedule: () => A.wizFrom(libDef.id) },
      runStd: () => A.startRun('std'), runExt: () => A.startRun('ext')
    };
    const WZ = s.wiz, wc = CATM[WZ.type];
    const wCount = WZ.people.filter(id => s.members.some(m => m.id === id)).length;
    const wClose = new Date(new Date(WZ.opens).getTime() + WZ.window * 864e5);
    const remDays = s.sched.reminders.filter(d => d < WZ.window).sort((a, b) => a - b);
    assess.wiz = {
      types: ['std', 'ext', 'pulse', 'tlf', 'cv'].map(id => Object.assign({ label: CATM[id].name, on: WZ.type === id, pick: () => A.wizSet('type', id) }, sty('chip', WZ.type === id))),
      info: (WZ.type === 'pulse' ? pulseComp(s).length : wc.items) + ' items · about ' + wc.min + ' min · ' + wc.who,
      dates: WDATES.map(d => Object.assign({ label: d, on: WZ.opens === d, pick: () => A.wizSet('opens', d) }, sty('chip', WZ.opens === d))),
      windows: [7, 14, 21, 30].map(n => Object.assign({ label: n + ' days', on: WZ.window === n, pick: () => A.wizSet('window', n) }, sty('chip', WZ.window === n))),
      people: s.members.map(m => Object.assign({ label: m.initials, name: m.name, pick: () => A.wizPerson(m.id) }, sty('chip', WZ.people.includes(m.id)))),
      count: wCount, total: s.members.length, tooFew: wCount < 4, isExt: WZ.type === 'ext', outside: A.toggleOutside, op: wCount >= 4 ? '1' : '0.45',
      summary: 'Opens ' + WZ.opens + ' and closes ' + fmtD(wClose) + '. Reminders on ' + (remDays.length ? remDays.map(d => 'day ' + d).join(', ') : 'no days') + ' go only to people who have not answered.',
      schedule: () => A.wizSchedule(false), openNow: () => A.wizSchedule(true),
      upcoming: s.rounds.filter(x => x.status === 'scheduled').map(roundV), noUpcoming: !s.rounds.some(x => x.status === 'scheduled')
    };
    const lvl = s.lpLevel[w];
    const myCvP = (PEOPLE[me.id] || {}).cv || {};
    assess.ind = {
      lp: [['lpq', 'Quick', 'Mini-IPIP', '20 items', 'About 4 min', '5 domains', 'Standard'], ['lpf', 'Full', 'IPIP-NEO-120', '120 items', 'About 20 min', '5 domains and 30 facets', 'Extensive']].map(([id, l, src, it, mn, out, level]) => { const done = !!s.profileDone[w] && lvl === id; return Object.assign({ label: l, src, items: it, min: mn, out, level, status: done ? 'Completed' : 'Not taken', cta: done ? 'Retake' : 'Start', run: () => A.startRun(id) }, sty('card', done)); }),
      shareLabel: SHARE_L[s.share[w]], goMe: () => A.go('me'), notCoach: !coach, isLeader: leader, isMember: member, isCoach: coach,
      tlfStatus: s.tlf.status === 'open' ? 'Open' : 'Closed', tlfRaters: s.tlf.raters, tlfOf: s.members.length - 1, tlfPct: (s.tlf.raters / Math.max(1, s.members.length - 1) * 100).toFixed(1) + '%', tlfEnough: s.tlf.raters >= 4,
      selfTodo: leader && s.tlf.status === 'open' && !s.tlf.selfDone, selfDone: leader && !!s.tlf.selfDone, rateKari: member && s.tlf.status === 'open' && !s.tlf.ratedMember, ratedKari: member && s.tlf.ratedMember, tlfClosed: s.tlf.status !== 'open', nextTlf: nextTlf ? nextTlf.label + ' opens ' + nextTlf.opens : 'No round scheduled',
      runTlf: () => A.startRun('tlf'), viewTlf: () => A.openPerson('kn'),
      myOpt: cvOf(me.id).opt, myRaters: myCvP.raters || 0, toggleMine: A.toggleCvOpt, cvm: toggleS(!!(member ? s.cv.optIn.member : s.cv.optIn.leader)), cvGroup: s.cv.group, toggleCvGroup: A.toggleCvGroup, cvg: toggleS(s.cv.group), myPage: () => A.openPerson(me.id),
      colleagues: s.members.filter(m => m.id !== me.id).map(m => { const o = cvOf(m.id).opt; const done = s.cvRated.includes(m.id); return Object.assign({ name: m.name, initials: m.initials, role: m.role, canRate: o && !done && !coach && !sample, state: !o ? 'Not opted in' : done ? 'Rated' : 'To rate', rate: () => A.startRun('cv', m.id) }, av(m.tone)); }),
      ratedCount: s.cvRated.length, toRate: s.members.filter(m => m.id !== me.id && cvOf(m.id).opt && !s.cvRated.includes(m.id)).length
    };
    const rdRes = s.rounds.find(x => x.id === (rnd === 1 ? 'r1' : 'r2')) || { status: 'released' };
    results.phases = stepsFor(rdRes); results.phaseStatus = PHN[rdRes.status]; results.phaseNext = nextAct[rdRes.status] || ''; results.canPhase = leader && !sample && !!nextAct[rdRes.status]; results.phaseGo = () => A.advanceRound(rdRes.id);
    results.roundKind = rnd === 1 ? 'Extensive diagnostic · 74 items · 8 of 8 answered' : 'Standard diagnostic · 48 items · 8 of 8 answered';
    results.questionsView = s.res.depth === 'questions';
    const qL = (s.res.qLayer === 'open' && rnd !== 1) ? 'conditions' : (s.res.qLayer || 'conditions');
    const offs = [0.2, -0.1, -0.1];
    results.q = {
      chips: LAYERS.concat(rnd === 1 ? [['open', 'Open questions']] : []).map(([id, l]) => Object.assign({ label: l, on: qL === id, pick: () => A.setRes({ qLayer: id }) }, sty('chip', qL === id))),
      isOpen: qL === 'open', isScales: qL !== 'open', showBars: rnd === 1, noBars: rnd !== 1, total: rnd === 1 ? 74 : 48,
      kind: rnd === 1 ? 'Extensive round: 3 items per scale with answer distributions, plus 2 open questions.' : 'Standard round: 2 items per scale with item means. Distributions and open questions come with the extensive diagnostic.',
      scales: SCALES.filter(x => x.layer === (qL === 'open' ? 'conditions' : qL)).map(x => ({ label: x.label, level: fmt(lv(x)), agree: AG[x.ag], ev: x.ev, evBg: evS(x.ev).bg, evFg: evS(x.ev).fg, sub: READ_NOTE[x.read] || '', hasSub: !!READ_NOTE[x.read], open: () => A.openScale(x.id),
        items: (ITEMS[x.id] || []).slice(0, rnd === 1 ? 3 : 2).map((t, k) => { const m = clamp(lv(x) + offs[k]); return { n: k + 1, text: t, mean: fmt(m), pct: pct(m), bars: dist(m, x.ag).map((c, j) => ({ n: c, h: (c / 8 * 100).toFixed(1) + '%', label: String(j + 1) })) }; }) })),
      open: OPEN_THEMES.map(([q, th]) => ({ q, themes: th.map(([t, c]) => ({ text: t, n: c + ' of 8', w: (c / 8 * 100).toFixed(1) + '%' })) }))
    };
    const SDEF = { purpose: 'How clear and shared the reason for this team is.', teamTasks: 'Whether the team knows which tasks and decisions belong to it.', size: 'Whether the team has the right number of members, with clear membership.', composition: 'The mix of skills and views in the team.', rewards: 'Whether goals and recognition reward working as one team.', info: 'Whether the team gets the information and support it needs.', preparation: 'How well members and items are prepared before meetings.', meetingGoals: 'Whether each agenda item has a clear desired outcome.', focus: 'Whether discussions stay on what matters most.', dialogue: 'How members listen, ask and build on each other.', taskConflict: 'Open disagreement about the work itself.', relConflict: 'Personal friction between members.', political: 'Hidden agendas, side deals and turf protection.', integration: 'How much members share information and decide together.', external: 'How the team manages its relations with the rest of the company.', learning: 'Whether the team reflects and changes how it works.', leadership: 'How the team leader sets direction and runs the team.', safety: 'Whether members can take risks and admit mistakes.', trust: 'Whether members rely on each other to deliver.', cohesion: 'How strongly members feel part of one team.', norms: 'Whether the team keeps and enforces its working agreements.', dac: 'Shared direction, aligned work and commitment to decisions.', viability: 'Whether the team can keep working well over time.', growth: 'Whether being in the team helps members develop.' };
    const WHY = { Strong: 'Meta-analyses show a consistent link between this scale and team results.', Moderate: 'Studies show a link to team results, but it is smaller or less consistent.', Mixed: 'Findings point both ways, so the scale is shown as a fact without a target.', 'Not yet rated': 'The evidence has not been rated yet. It is treated as moderate until reviewed.', 'Self-rated': 'An outcome the team rates itself. Read it next to the outside view when available.' };
    const sx = SC[s.res.scale] || SC.focus; const nI2 = rnd === 1 ? 3 : 2; const cd = sx.id.slice(0, 3).toUpperCase();
    const valsOf = c => { const a = []; c.forEach((n, j) => { for (let i = 0; i < n; i++) a.push(j + 1); }); return a; };
    const sdOf = a => { const m = mean(a); return Math.sqrt(a.reduce((t, x) => t + (x - m) * (x - m), 0) / Math.max(1, a.length - 1)); };
    const agL = r => r > 0.7 ? 'High agreement' : r > 0.5 ? 'Medium agreement' : 'Views differ';
    const chg = d => Math.abs(d) >= 0.29 ? (d > 0 ? '+' : '−') + fmt(Math.abs(d)) : 'Stable';
    const itemsX = (ITEMS[sx.id] || []).slice(0, nI2).map((t, k) => { const m2 = clamp(lv(sx) + offs[k]), m1 = clamp(sx.r1 + offs[k]); const c = dist(m2, sx.ag); const v = valsOf(c); const sd = sdOf(v); const rw = Math.max(0, 1 - sd * sd / 2); const ag = c[3] + c[4], ne = c[2], di = c[0] + c[1];
      return { code: cd + '-' + (k + 1), text: t, mean: fmt(m2), m2, r1: fmt(m1), change: rnd === 1 ? 'First round' : chg(m2 - m1), sd: sd.toFixed(2), rwg: rw.toFixed(2), agree: agL(rw), pct: pct(m2), r1pct: pct(m1), showR1: rnd === 2,
        agP: Math.round(ag / 8 * 100) + '%', neP: Math.round(ne / 8 * 100) + '%', diP: Math.round(di / 8 * 100) + '%', agW: (ag / 8 * 100).toFixed(1) + '%', neW: (ne / 8 * 100).toFixed(1) + '%', diW: (di / 8 * 100).toFixed(1) + '%',
        bars: c.map((n, j) => ({ n: String(n), p: Math.round(n / 8 * 100) + '%', h: (n / 8 * 100).toFixed(1) + '%', label: String(j + 1), anchor: OPTS[j] })), vals: v, badge: '', hasBadge: false }; });
    if (itemsX.length > 1) { const hi = itemsX.reduce((b, x, k) => x.m2 > itemsX[b].m2 ? k : b, 0), lo = itemsX.reduce((b, x, k) => x.m2 < itemsX[b].m2 ? k : b, 0); if (hi !== lo) { itemsX[hi].badge = 'Highest in scale'; itemsX[hi].hasBadge = true; itemsX[lo].badge = 'Lowest in scale'; itemsX[lo].hasBadge = true; } }
    const pScores = [0, 1, 2, 3, 4, 5, 6, 7].map(p => mean(itemsX.map(it => it.vals[p] || 3)));
    const pSorted = pScores.slice().sort((a, b) => a - b); const pSd = sdOf(pScores); const hist = [0, 0, 0, 0, 0]; pScores.forEach(v => hist[Math.max(0, Math.min(4, Math.round(v) - 1))]++);
    const isF = s.focus.includes(sx.id); const x_ser = series(sx.id);
    const trendPts = isF ? PULSE_LABELS.map((l, k) => ({ label: l, v: fmt(x_ser[k]), h: hpct(x_ser[k]) })) : [{ label: 'Round 1 · Mar', v: fmt(sx.r1), h: hpct(sx.r1) }, { label: 'Round 2 · Sep', v: fmt(sx.r2), h: hpct(sx.r2) }];
    const x_low = lv(sx) < 3.2, ll = sx.label.toLowerCase();
    const disc = sx.ag === 'low' ? ['Some of us rate this high and others x_low. What does each of us see?', 'Which situations make the difference?', 'What would we need to agree on before choosing a fix?'] : sx.read === 'lower' ? ['When did this last show up, and what triggered it?', 'What keeps it at this level today?', 'What would we do the moment it starts to grow?'] : sx.read === 'descriptive' ? ['Is this set-up a fact we work with, or something to change?', 'Where does it help us, and where does it get in the way?', 'Who outside the team should we ask?'] : x_low ? ['What gets in the way of ' + ll + ' today?', 'Where did we see it work well in the last three months?', 'What one change would move it the most?'] : ['What are we doing that keeps ' + ll + ' at this level?', 'Where could it slip under pressure?', 'Who sees it differently, and why?'];
    const oIdx = SCALES.findIndex(x => x.id === sx.id); const prevS = SCALES[(oIdx - 1 + SCALES.length) % SCALES.length], nextS = SCALES[(oIdx + 1) % SCALES.length];
    const keepD = s.res.depth === 'items' ? 'items' : 'scale';
    results.sx = {
      code: cd, def: SDEF[sx.id] || '', why: WHY[sx.ev] || '', layerSub: LAYER_SUB[sx.layer] || '', n: '8 of 8', nItems: itemsX.length, roundKind: rnd === 1 ? 'Extensive round · 3 items, full distributions' : 'Standard round · 2 items, three-band split',
      score: fmt(lv(sx)), sd: pSd.toFixed(2), min: fmt(pSorted[0]), max: fmt(pSorted[7]), median: fmt((pSorted[3] + pSorted[4]) / 2), rwg: Math.max(0, 1 - pSd * pSd / 2).toFixed(2), agree: AG[sx.ag], evText: sx.ev,
      hist: hist.map((n, j) => ({ label: String(j + 1), n: String(n), h: (n / 8 * 100).toFixed(1) + '%' })),
      trend: trendPts, trendNote: isF ? 'Focus area: tracked at every pulse since round 1.' : 'Not a focus area, so it is measured at diagnostics only.',
      items: itemsX, showDist: rnd === 1, noDist: rnd !== 1, disc: disc.map((t, k) => ({ n: k + 1, text: t })),
      patterns: pats.filter(p => p.tag.indexOf(sx.label) >= 0).map(p => ({ title: p.title, text: p.text, cta: p.cta, go: p.go })), hasPatterns: pats.some(p => p.tag.indexOf(sx.label) >= 0),
      prev: () => A.setRes({ scale: prevS.id, depth: keepD }), next: () => A.setRes({ scale: nextS.id, depth: keepD }), prevLabel: prevS.label, nextLabel: nextS.label, allQ: () => A.setRes({ depth: 'questions', qLayer: sx.layer }),
      nav: LAYERS.map(([lid, lab]) => ({ title: lab, scales: SCALES.filter(x => x.layer === lid).map(x => { const on = x.id === sx.id; return { label: x.label, level: fmt(lv(x)), nbg: on ? T.card.on.bg : 'transparent', nbd: on ? T.card.on.bd : 'transparent', nfw: on ? '700' : '500', open: () => A.setRes({ scale: x.id, depth: keepD, layer: x.layer === 'outcomes' ? s.res.layer : x.layer }) }; }) }))
    };
    const qL3 = (s.res.qLayer === 'open' && rnd !== 1) ? 'all' : (s.res.qLayer || 'all');
    const fullScale = x => { const code = x.id.slice(0, 3).toUpperCase(); const its = (ITEMS[x.id] || []).slice(0, nI2).map((t, k) => { const m2 = clamp(lv(x) + offs[k]), m1 = clamp(x.r1 + offs[k]); const c = dist(m2, x.ag); const v = valsOf(c); const sd = sdOf(v); const ag = c[3] + c[4], ne = c[2], di = c[0] + c[1];
        return { code: code + '-' + (k + 1), text: t, mean: fmt(m2), r1: rnd === 1 ? '–' : fmt(m1), change: rnd === 1 ? 'First' : chg(m2 - m1), sd: sd.toFixed(2), agP: Math.round(ag / 8 * 100) + '%', agW: (ag / 8 * 100).toFixed(1) + '%', neW: (ne / 8 * 100).toFixed(1) + '%', diW: (di / 8 * 100).toFixed(1) + '%', vals: v, bars: c.map(n => ({ n: String(n), h: (n / 8 * 100).toFixed(1) + '%' })) }; });
      const ps = [0, 1, 2, 3, 4, 5, 6, 7].map(p => mean(its.map(it => it.vals[p] || 3))); const psd = sdOf(ps);
      return { code, label: x.label, level: fmt(lv(x)), change: rnd === 1 ? 'First round' : chg(x.r2 - x.r1), agree: AG[x.ag], ev: x.ev, evBg: evS(x.ev).bg, evFg: evS(x.ev).fg, sub: READ_NOTE[x.read] || '', hasSub: !!READ_NOTE[x.read], sd: psd.toFixed(2), rwg: Math.max(0, 1 - psd * psd / 2).toFixed(2), pct: pct(lv(x)), open: () => A.openScale(x.id), items: its }; };
    results.q.chips = [['all', 'All scales']].concat(LAYERS).concat(rnd === 1 ? [['open', 'Open questions']] : []).map(([id, l]) => Object.assign({ label: l, on: qL3 === id, pick: () => A.setRes({ qLayer: id }) }, sty('chip', qL3 === id)));
    results.q.isOpen = qL3 === 'open'; results.q.isScales = qL3 !== 'open';
    results.q.groups = (qL3 === 'all' ? LAYERS : LAYERS.filter(l => l[0] === qL3)).map(([lid, lab]) => { const xs = SCALES.filter(x => x.layer === lid); return { title: lab, sub: LAYER_SUB[lid], count: xs.length, nItems: xs.length * nI2, scales: xs.map(fullScale) }; });
    results.q.scope = qL3 === 'all' ? '24 scales · ' + (24 * nI2) + ' items' + (rnd === 1 ? ' · 2 open questions' : '') : '';
    // v3 home
    {
      const myOpen = s.actions.filter(a => a.owner === me.id && !a.done);
      const needs = todos.map(t => Object.assign({ kind: 'Assessment' }, t));
      myOpen.forEach(a => needs.push({ icon: 'lucide:circle-check', kind: 'Your action', title: a.text, meta: 'Due ' + a.due + ' · shows on Home until done', cta: 'Mark done', go: () => A.toggleAction(a.id) }));
      if (leader && !sample) {
        const r2 = s.rounds.find(x => x.id === 'r2');
        if (r2 && r2.status === 'released') needs.push({ icon: 'lucide:presentation', kind: 'Leader', title: 'Hold the results session for round 2', meta: 'Released 30 Sep · planned 7 Oct · read it together and pick focus areas', cta: 'Mark held', go: () => A.advanceRound('r2') });
        if (s.focus.length < 2) needs.push({ icon: 'lucide:target', kind: 'Leader', title: s.focus.length ? 'Choose a second focus area' : 'Choose a focus area', meta: 'Up to 2 can be active · pulses track them', cta: 'Choose', go: () => A.set({ route: 'develop', devTab: 'focus' }) });
        s.members.filter(m => stOf(m.id) === 'invited').forEach(m => needs.push({ icon: 'lucide:mail', kind: 'Leader', title: m.name + ' has not joined yet', meta: ((PEOPLE[m.id] || {}).since || 'Invited') + ' · ' + m.role, cta: 'Resend', go: () => A.toastMsg('Invitation sent again to ' + m.name) }));
        s.rounds.filter(x => x.status === 'open' && x.answered < 4).forEach(x => needs.push({ icon: 'lucide:bell', kind: 'Leader', title: x.label + ' needs ' + (4 - x.answered) + ' more answers', meta: 'Below 4 answers there is no result', cta: 'Remind', go: () => A.toastMsg('Reminder sent to the ' + (x.of - x.answered) + ' who have not answered. Nobody sees who.') }));
      }
      const kindS = k => k === 'Leader' ? T.evModerate : k === 'Your action' ? T.evOther : T.evStrong;
      home.needs = needs.map(n => Object.assign({}, n, { kbg: kindS(n.kind).bg, kfg: kindS(n.kind).fg }));
      home.needCount = needs.length; home.noNeeds = needs.length === 0;
      const pm = !!s.pulseMine;
      home.live = [{ icon: 'lucide:activity', name: 'Pulse 6', sub: 'Closes Wed 7 Oct · ' + pulseComp(s).length + ' items', answered: s.pulse.answered, of: s.pulse.of, pct: (s.pulse.answered / s.pulse.of * 100).toFixed(1) + '%', thr: s.pulse.answered >= 4 ? 'Result guaranteed' : (4 - s.pulse.answered) + ' more needed', canAnswer: !pm && !coach && !sample, answeredMe: pm, answer: () => A.startRun('pulse'), canSim: s.pulse.answered < s.pulse.of, sim: A.simPulse }]
        .concat(s.rounds.filter(x => x.status === 'open').map(rd => { const v = roundV(rd); return { icon: v.icon, name: v.label + ' · ' + v.name, sub: 'Closes ' + v.closes, answered: v.answered, of: v.of, pct: v.pct, thr: v.answered >= 4 ? 'Result guaranteed' : (4 - v.answered) + ' more needed', canAnswer: v.canAnswer, answeredMe: v.answeredMe, answer: v.answer, canSim: v.canSim, sim: v.sim }; }));
      home.liveCount = home.live.length;
      const ok = SCALES.filter(x => x.layer !== 'outcomes' && (x.read === 'higher' || x.read === 'lower'));
      const adj2 = x => x.read === 'lower' ? 6 - x.r2 : x.r2;
      const sRow = x => ({ label: x.label, level: fmt(x.r2), pct: pct(x.r2), note: x.read === 'lower' ? 'Lower is better · ' + AG[x.ag] : AG[x.ag], open: () => A.openScale(x.id) });
      const d0 = x => x.r2 - x.r1;
      home.stand = {
        strong: ok.slice().sort((a, b) => adj2(b) - adj2(a)).slice(0, 3).map(sRow),
        watch: ok.slice().sort((a, b) => adj2(a) - adj2(b)).slice(0, 3).map(sRow),
        moved: SCALES.filter(x => Math.abs(d0(x)) >= 0.29).sort((a, b) => Math.abs(d0(b)) - Math.abs(d0(a))).slice(0, 4).map(x => ({ label: x.label, change: chg(d0(x)), from: fmt(x.r1) + ' → ' + fmt(x.r2), open: () => A.openScale(x.id) })),
        differ: SCALES.filter(x => x.ag === 'low').map(x => ({ label: x.label, level: fmt(x.r2), open: () => A.openScale(x.id) })),
        layers: assess.o.stand, high: results.cnt.high, medium: results.cnt.medium, low: results.cnt.low,
        title: 'Round 2 · standard diagnostic', meta: 'Released 30 Sep · 8 of 8 answered · compared with round 1, March 2026',
        go: () => { A.setRes({ round: 2, depth: 'overview' }); A.go('results'); }, goAll: () => { A.setRes({ round: 2, depth: 'questions', qLayer: 'all' }); A.go('results'); }
      };
      home.focus3 = fcs.map((sc, k) => { const se = series(sc.id); const pr = PRACTICES.find(p => p.scale === sc.id); const inUse = !!pr && s.practices.includes(pr.id);
        return { n: k + 1, label: sc.label, level: fmt(se[6]), change: chg(se[6] - se[0]), agree: AG[sc.ag], ev: sc.ev, spark: se.map((v, i) => ({ h: hpct(v), bg: i === 6 ? T.dotOn : T.dotOff, v: fmt(v) })), hasPr: !!pr, practice: pr ? pr.name : '', prState: inUse ? 'In use' : 'Not in use yet', open: () => A.openScale(sc.id), goPractice: () => pr && A.openPractice(pr.id) }; });
      home.focusOpen3 = fcs.length < 2;
      home.team3 = { members: s.members.map(m => Object.assign({ initials: m.initials, name: m.name, op: stOf(m.id) === 'invited' ? '0.45' : '1' }, av(m.tone))), active: s.members.filter(m => stOf(m.id) !== 'invited').length, invited: s.members.filter(m => stOf(m.id) === 'invited').length, total: s.members.length,
        sharing: sharers.length, opted: s.members.filter(m => cvOf(m.id).opt).length, mapText: tmap.open ? 'Team map open' : 'Map opens at 3', openActions: s.actions.filter(a => !a.done).length, doneActions: s.actions.filter(a => a.done).length,
        go: () => A.go('people'), goMap: () => A.set({ route: 'people', peopleTab: 'map' }), goActions: () => A.set({ route: 'develop', devTab: 'focus' }) };
      const fnd = [];
      if (!coach && answeredCount < 12) fnd.push({ icon: 'lucide:list-checks', kind: 'Scan', title: answeredCount ? 'Finish your Team Scan' : 'Answer the Team Scan', meta: answeredCount + ' of 12 answered · about 3 minutes', cta: answeredCount ? 'Continue' : 'Start', go: A.startScan });
      if (answered < 4) fnd.push({ icon: 'lucide:link', kind: 'Scan', title: needed + ' more answer' + (needed === 1 ? '' : 's') + ' needed for the team view', meta: answered + ' of ' + cap + ' answered · counts only, never names', cta: 'Copy invite link', go: A.copyLink });
      else fnd.push({ icon: 'lucide:eye', kind: 'Scan', title: 'Read the team view together', meta: 'You agree most on ' + agreeOn.label + ' · views differ most on ' + differOn.label, cta: 'Open', go: () => A.go('team') });
      if (!coach && !s.profileDone[w]) fnd.push({ icon: 'lucide:user-round', kind: 'Profile', title: 'Take the Leader Profile', meta: 'Quick · 20 items · private to you · free', cta: 'Start', go: () => A.startRun('lpq') });
      if (leader) fnd.push({ icon: 'lucide:sparkles', kind: 'Leader', title: 'Unlock the full diagnostic', meta: '24 scales, pulses, charter and people · ' + PRICE + ' per group per year', cta: 'Upgrade', go: A.openUpgrade });
      const kS = k => k === 'Leader' ? T.evModerate : k === 'Profile' ? T.evOther : T.evStrong;
      home.fneeds = fnd.map(n => Object.assign({}, n, { kbg: kS(n.kind).bg, kfg: kS(n.kind).fg })); home.fneedCount = fnd.length;
      home.fscan = { answered, cap, pct: (answered / cap * 100).toFixed(1) + '%', needed, ready: answered >= 4, notReady: answered < 4, dots: Array.from({ length: cap }, (_, k) => ({ bg: k < answered ? T.dotOn : T.dotOff })), link: 'leaderpact.com/j/lumio-7Kq', copy: A.copyLink, copyLabel: s.invite.copied ? 'Copied' : 'Copy', canSim: answered < cap, sim: A.simulate, mine: answeredCount + ' of 12', agreeOn: agreeOn.label, differOn: differOn.label, hasDiffer: differOn.rwg <= 0.5, goTeam: () => A.go('team') };
      home.fplan = [['lucide:clipboard-check', 'Full diagnostic', '24 scales with evidence ratings, standard or extensive'], ['lucide:activity', 'Pulses', 'Every 4 weeks on your focus areas and agreements'], ['lucide:target', 'Focus areas and actions', 'Up to 2 focus areas, linked practices, owners'], ['lucide:users', 'Charter and people', 'Purpose, team tasks, profiles and contribution feedback']].map(([icon, t, x]) => ({ icon, title: t, text: x }));
      home.fLeader = leader; home.fOther = !leader;
      home.statusLine = paid ? (needs.length ? needs.length + (needs.length === 1 ? ' thing needs' : ' things need') + ' you' : 'Nothing needs you right now') + ' · ' + home.live.length + ' open for answers · next up: ' + (firstSched ? firstSched.label + ', ' + firstSched.opens : 'nothing scheduled') : (home.fneedCount + (home.fneedCount === 1 ? ' thing needs' : ' things need') + ' you · scan ' + answered + ' of ' + cap + ' answered · Free plan, latest scan only');
    }
    const settings = (() => {
      const ST = s.set, B = s.bill;
      const tabs = [['account', 'Account', 'lucide:user'], ['group', 'Group', 'lucide:users'], ['notifications', 'Notifications', 'lucide:bell'], ['privacy', 'Privacy and data', 'lucide:shield'], ['plan', 'Plan and billing', 'lucide:credit-card'], ['appearance', 'Appearance', 'lucide:layout-panel-left']].filter(t => !(coach && (t[0] === 'group' || t[0] === 'plan')));
      const tab = tabs.some(t => t[0] === ST.tab) ? ST.tab : 'account';
      const tg = on => ({ tbg: on ? T.toggleOn : T.toggleOff, knob: on ? 'flex-end' : 'flex-start' });
      const ch = (list, cur, fn) => list.map(v => Object.assign({ label: String(v), on: cur === v, pick: () => fn(v) }, sty('chip', cur === v)));
      const NOTIF = [['roundOpen', 'A round or pulse opens', 'Email with the link to answer'], ['reminder', 'Reminders while a round is open', 'Only if you have not answered yet'], ['released', 'Results are released', 'Everyone gets them at the same moment'], ['actions', 'Actions due', 'Two days before the due date'], ['feedback', 'Feedback rounds', 'When you are asked to rate, or your own results are ready'], ['digest', 'Weekly summary', 'Monday morning: what needs you this week']];
      const yr = B.period === 'year';
      const sub = yr ? 1800 : 180, vat = sub * 0.25;
      const money = n => 'USD'.replace('USD', String.fromCharCode(36)) + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
      const D = String.fromCharCode(36);
      const PL = [
        { id: 'free', name: 'Free', price: D + '0', per: 'forever', items: ['Team Scan, 12 questions', 'Team view at 4 answers', 'Leader Profile, quick and full', 'Latest scan only, no history'] },
        { id: 'team', name: 'Team', price: yr ? D + '1,800' : D + '180', per: yr ? 'per group per year' : 'per group per month', items: ['Everything in Free', 'Full diagnostic, standard and extensive', 'Pulses every 2 to 8 weeks', 'Charter, people and team map', 'Focus areas, actions and practices', 'Team-leader feedback and contribution view', 'Profile modules', 'Full history and trends'] },
        { id: 'org', name: 'Organisation', price: 'Custom', per: 'from 5 groups', items: ['Everything in Team', 'Outside view with up to 8 raters', 'Several groups, one admin', 'Aggregated view across groups, never single teams', 'Single sign-on and a data processing agreement'] }
      ];
      const plans = PL.map(p => { const cur = s.plan === p.id; const featured = p.id === 'team';
        let cta = '', go = null, primary = false;
        if (p.id === 'org') { cta = 'Talk to us'; go = A.talkToUs; }
        else if (cur) { cta = 'Current plan'; }
        else if (leader && p.id === 'team') { cta = 'Upgrade'; go = () => A.billStep(1); primary = true; }
        else if (leader && p.id === 'free') { cta = 'Switch to Free'; go = A.downStart; }
        else if (p.id === 'team') { cta = 'Ask Kari to upgrade'; }
        return Object.assign({ name: p.name, price: p.price, per: p.per, items: p.items.map(t => ({ text: t })), current: cur, featured, cta, hasGo: !!go, noGo: !go, go: go || (() => {}), primary, secondary: !!go && !primary }, sty('card', featured)); });
      const stepL = ['Plan', 'Billing details', 'Review', 'Done'];
      const flow = paid ? false : leader;
      return {
        tabs: tabs.map(([id, l, icon]) => Object.assign({ label: l, icon, on: tab === id, pick: () => A.setTab(id) }, sty('nav', tab === id))),
        account: tab === 'account', group: tab === 'group', notifications: tab === 'notifications', privacy: tab === 'privacy', plan: tab === 'plan', appearance: tab === 'appearance',
        me: { name: me.name, initials: me.initials, abg: me.abg, afg: me.afg, role: roleLabel, email: coach ? 'anne@vikcoaching.no' : member ? 'lars@lumio.no' : ST.email, setEmail: e => A.setSet('email', e.target.value) },
        langs: ch(['English', 'Norsk', 'Svenska'], ST.lang, v => A.setSet('lang', v)), tzs: ch(['Europe/Oslo', 'Europe/Stockholm', 'Europe/London'], ST.tz, v => A.setSet('tz', v)),
        save: () => A.saveSet('Account saved'), signOutAll: () => A.saveSet('Signed out on all other devices'), deleteAccount: () => A.saveSet('Prototype: account deletion asks for email confirmation'),
        g: { name: s.save.groupName, setName: e => A.setGroupName(e.target.value), canEdit: leader && !sample, readOnly: !(leader && !sample), members: s.members.length, coachText: s.coachAccess ? 'Anne Vik can see group-level results' : 'Coach access withdrawn', toggleCoach: A.toggleCoach, cg: tg(s.coachAccess),
          anon: ch([4, 5, 6], ST.anon, A.setAnon).map(o => Object.assign(o, { label: o.label + ' answers' })), qlangs: ch(['English', 'Norsk'], ST.qlang, v => A.setSet('qlang', v)), goPeople: () => A.go('people'), goPulse: () => A.set({ route: 'assess', assessTab: 'pulse' }), save: () => A.saveSet('Group settings saved'), del: () => A.saveSet('Prototype: deleting a group needs confirmation from Lumio AS') },
        notif: NOTIF.map(([k, l, d]) => Object.assign({ label: l, desc: d, toggle: () => A.toggleNotif(k) }, tg(!!ST.notif[k]))), notifOn: NOTIF.filter(n => ST.notif[n[0]]).length,
        p: {
          lpDone: !!s.profileDone[w], lpStatus: s.profileDone[w] ? 'Completed · sharing: ' + SHARE_L[s.share[w]] : 'Not taken', delProfile: A.deleteProfile, goMe: () => A.go('me'),
          cvStatus: !s.cv.group ? 'Turned off for the group' : cvOf(me.id).opt ? 'Opted in · you can withdraw at any time' : 'Not opted in', toggleCv: A.toggleCvOpt, cv: tg(!!(member ? s.cv.optIn.member : s.cv.optIn.leader)), cvGroup: s.cv.group && !coach,
          modules: s.modules[w].length, exportData: () => A.saveSet('Your data export is being prepared. It arrives by email as a JSON file.'),
          rules: [['Anonymity', 'Group results show only at ' + ST.anon + ' or more answers. No subgroup filters exist.'], ['No names with answers', 'Survey answers are stored without a person ID. Counts only, never who.'], ['Individual results', 'Profiles and feedback go to the person first. They choose what to share.'], ['Retention', 'Kept while the plan is active, plus 90 days. Then deleted.'], ['Purpose', 'Development only. Never used for selection, promotion or performance evaluation.']].map(([t, x]) => ({ title: t, text: x }))
        },
        b: {
          plans, isFree: free, isTeam: paid, isLeader: leader, notLeader: !leader,
          flow: flow && B.step >= 1 && B.step <= 3, picking: flow && B.step === 0, s1: B.step === 1, s2: B.step === 2, s3: B.step === 3, notS3: B.step !== 3, done: B.step === 4 && paid, manage: paid && B.step !== 4,
          steps: stepL.map((l, k) => ({ n: k + 1, label: l, bar: k + 1 < B.step ? T.stepDone : k + 1 === B.step ? T.stepCur : T.dotOff, fg: k + 1 <= B.step ? (T.ink || '#16131f') : (T.muted || '#7a7488') })),
          periods: [['year', 'Yearly', D + '1,800 per year · 2 months free'], ['month', 'Monthly', D + '180 per month']].map(([k, l, d]) => Object.assign({ label: l, desc: d, on: B.period === k, pick: () => A.billSet('period', k), mark: B.period === k ? 'lucide:circle-dot' : 'lucide:circle' }, sty('opt', B.period === k))),
          methods: [['invoice', 'Invoice', 'EHF or PDF, 30 days'], ['card', 'Card', 'Charged today']].map(([k, l, d]) => Object.assign({ label: l, desc: d, on: B.method === k, pick: () => A.billSet('method', k), mark: B.method === k ? 'lucide:circle-dot' : 'lucide:circle' }, sty('opt', B.method === k))),
          isCard: B.method === 'card', isInvoice: B.method === 'invoice',
          company: B.company, setCompany: e => A.billSet('company', e.target.value), org: B.org, setOrg: e => A.billSet('org', e.target.value), email: B.email, setEmail: e => A.billSet('email', e.target.value), ref: B.ref, setRef: e => A.billSet('ref', e.target.value),
          emailBad: !!B.email && !validEmail(B.email),
          sub: money(sub), vat: money(vat), total: money(sub + vat), per: yr ? 'per year' : 'per month', periodLabel: yr ? 'Yearly' : 'Monthly', methodLabel: B.method === 'card' ? 'Card ending 4242' : 'Invoice to ' + B.email,
          next: A.billNext, back: A.billBack, confirm: A.billConfirm, cancelFlow: () => A.billStep(0),
          unlocked: ['Schedule your first full diagnostic', 'Set up the charter and working agreements', 'Choose up to 2 focus areas', 'Turn on pulses every 4 weeks'].map(t => ({ text: t })),
          goHome: () => A.go('home'), goSchedule: () => A.set({ route: 'assess', assessTab: 'schedule' }), toManage: () => A.billStep(0),
          renew: B.since ? (yr ? '5 Oct 2027' : '5 Nov 2026') : '1 Apr 2027', since: B.since || '1 Apr 2026',
          invoices: (B.since ? [['INV-2026-0142', B.since, money(sub + vat), 'Paid']] : []).concat([['INV-2026-0031', '1 Apr 2026', money(2250), 'Paid']]).map(([n, d, a, st]) => ({ n, d, a, st })),
          down: B.down, downStart: A.downStart, downCancel: A.downCancel, downConfirm: A.downConfirm, canDown: leader && paid && !B.down,
          lose: ['Results history and trends', 'Pulses and the assessment schedule', 'Charter, focus areas, actions and practices', 'Team-leader feedback and contribution view'].map(t => ({ text: t }))
        },
        ap: { navs: [['horizontal', 'Horizontal menu', 'Across the top'], ['vertical', 'Vertical menu', 'In a sidebar']].map(([k, l, d]) => Object.assign({ label: l, desc: d, on: s.ui.nav === k, pick: () => A.setNav(k), mark: s.ui.nav === k ? 'lucide:circle-dot' : 'lucide:circle' }, sty('opt', s.ui.nav === k))),
          widths: [[false, 'Contained', 'Content keeps a readable width'], [true, 'Full width', 'Content fills the window']].map(([k, l, d]) => Object.assign({ label: l, desc: d, on: s.ui.wide === k, pick: () => A.setWide(k), mark: s.ui.wide === k ? 'lucide:circle-dot' : 'lucide:circle' }, sty('opt', s.ui.wide === k))) }
      };
    })();
    // v4: standing, plan, meetings, 360
    const STAT = x => { if (x.read === 'descriptive') return ['Fact, no target', 'lucide:info']; if (x.ag === 'low') return ['Views differ', 'lucide:split']; if (x.read === 'conditional') return ['Read with relationship conflict', 'lucide:link']; const v = x.r2; if (x.read === 'lower') return v >= 3.5 ? ['Priority', 'lucide:flag'] : v >= 2.8 ? ['Keep watching', 'lucide:eye'] : ['Strength', 'lucide:check']; if (v < 3.0 && x.ev !== 'Mixed') return ['Priority', 'lucide:flag']; if (v < 3.4) return ['Keep watching', 'lucide:eye']; return ['Strength', 'lucide:check']; };
    const stRows = SCALES.map(x => { const st = STAT(x); const p = s.proj.find(q => q.scale === x.id); return { id: x.id, label: x.label, layer: x.layer, sub: READ_NOTE[x.read] || 'Higher is better', ev: x.ev, evBg: evS(x.ev).bg, evFg: evS(x.ev).fg, level: fmt(x.r2), pct: pct(x.r2), tick: pct(x.r1), change: Math.abs(x.r2 - x.r1) >= 0.29 ? (x.r2 > x.r1 ? '+' : '−') + fmt(Math.abs(x.r2 - x.r1)) : 'Stable', agree: AG[x.ag], status: st[0], icon: st[1], inPlan: !!p, notInPlan: !p, planName: p ? p.title : '', open: () => A.openScale(x.id), toPlan: () => A.set({ route: 'develop', devTab: 'plan', projOpen: p ? p.id : s.projOpen }), canAdd: !p && st[0] === 'Priority' && canAct, add: () => A.addInit(x.id) }; });
    const ciMeans = s.agenda.slice().sort((a, b) => b.minutes - a.minutes).slice(0, 5).map(it => { const o = s.live.outcomes[it.id]; const b = o === 'reached' ? [4.1, 3.8, 4.2] : o === 'carried' ? [3.4, 3.0, 2.6] : o === 'parked' ? [3.0, 2.7, 2.4] : [3.6, 3.3, 3.4]; return { title: it.title, type: it.type || 'No type', clear: fmt(b[0]), focus: fmt(b[1]), outcome: fmt(b[2]), cp: pct(b[0]), fp: pct(b[1]), op: pct(b[2]) }; });
    const c3 = s.c360, p3 = id => c3.people[id] || { status: 'none', raters: { mgr: { n: 0, of: 0 }, peer: { n: 0, of: 0 }, dr: { n: 0, of: 0 }, oth: { n: 0, of: 0 } } };
    const ST3 = { none: 'Not started', nominate: 'Choosing raters', collecting: 'Collecting answers', report: 'Report ready' };
    const reports = s.members.filter(m => p3(m.id).status === 'report').length;
    results.standingView = s.res.depth === 'standing';
    results.st = {
      groups: LAYERS.map(([lid, ll]) => ({ title: ll, sub: LAYER_SUB[lid], count: stRows.filter(r => r.layer === lid).length, rows: stRows.filter(r => r.layer === lid) })),
      counts: [['Strength', 'lucide:check'], ['Keep watching', 'lucide:eye'], ['Priority', 'lucide:flag'], ['Views differ', 'lucide:split'], ['Fact, no target', 'lucide:info']].map(([l, ic]) => ({ label: l, icon: ic, n: stRows.filter(r => r.status === l).length })),
      planned: stRows.filter(r => r.inPlan).length, unplanned: stRows.filter(r => r.status === 'Priority' && !r.inPlan).map(r => r.label).join(', ') || 'None', hasUnplanned: stRows.some(r => r.status === 'Priority' && !r.inPlan),
      sources: [['lucide:clipboard-check', 'Full diagnostic', 'Round 2 · 8 of 8 · released 30 Sep'], ['lucide:activity', 'Pulse 6', s.pulse.answered + ' of ' + s.pulse.of + ' answered · closes Wed'], ['lucide:message-circle-question', 'Meeting check-in', s.live.ended ? s.mtg.ci.answered + ' answered for the last meeting' : 'Opens when the next meeting closes'], ['lucide:message-square', 'Team-leader feedback', s.tlf.raters + ' raters · ' + (s.tlf.status === 'open' ? 'open' : 'closed')], ['lucide:radar', 'CXO 360', reports + ' of ' + s.members.length + ' reports ready · private to each leader'], ['lucide:users-round', 'Outside view', 'Not run · Organisation plan']].map(([icon, l, t]) => ({ icon, label: l, text: t })),
      goPlan: () => A.set({ route: 'develop', devTab: 'plan' })
    };
    results.depths = [['standing', 'Standing'], ['questions', 'All scales and items'], ['overview', 'Overview'], ['scale', 'Scale'], ['items', 'Items']].map(([id, l]) => Object.assign({ label: l, on: s.res.depth === id, pick: () => A.setRes({ depth: id }) }, sty('tab', s.res.depth === id)));
    const MON6 = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const PST = { on: ['On track', 'lucide:circle-check'], risk: ['At risk', 'lucide:triangle-alert'], done: ['Done', 'lucide:badge-check'], todo: ['Not started', 'lucide:circle-dashed'] };
    const msAll = [].concat.apply([], s.proj.map(p => p.ms));
    const pv = {
      months: MON6.map((m, k) => ({ label: m, year: k < 3 ? '2026' : '2027' })),
      items: s.proj.map(p => { const sc = SC[p.scale] || SC.focus; const sr = series(p.scale); const o = person(p.owner); const dn = p.ms.filter(m => m.done).length; const st = PST[p.status] || PST.todo; const op = s.projOpen === p.id; const pr = PRACTICES.find(x => x.scale === p.scale);
        return { id: p.id, title: p.title, scale: sc.label, base: fmt(sc.r2), now: fmt(sr[sr.length - 1]), target: p.target, kpi: p.kpi || 'No business measure linked yet', owner: o.name, initials: o.initials, abg: o.abg, afg: o.afg, status: st[0], sIcon: st[1], doneN: dn, total: p.ms.length, progress: Math.round(dn / Math.max(1, p.ms.length) * 100) + '%',
          left: (p.start / 6 * 100).toFixed(2) + '%', width: ((p.end - p.start + 1) / 6 * 100).toFixed(2) + '%', open: op, chev: op ? 'lucide:chevron-up' : 'lucide:chevron-down', toggle: () => A.set({ projOpen: op ? null : p.id }),
          ms: p.ms.map((m, j) => ({ text: m.t, due: m.due, done: m.done, icon: m.done ? 'lucide:square-check' : 'lucide:square', toggle: () => A.toggleMs(p.id, j), left: ((m.m + 0.5) / 6 * 100).toFixed(2) + '%', dot: m.done ? (T.stepDone || '#333') : '#ffffff' })),
          statuses: [['on', 'On track'], ['risk', 'At risk'], ['done', 'Done']].map(([k, l]) => Object.assign({ label: l, pick: () => A.projStatus(p.id, k) }, sty('chip', p.status === k))),
          newMs: s.newMs[p.id] || '', setNewMs: e => A.setNewMs(p.id, e.target.value), addMs: () => A.addMs(p.id), remove: () => A.removeProj(p.id),
          practice: pr ? pr.name : 'No practice linked', goPractice: () => pr && A.openPractice(pr.id), goScale: () => A.openScale(p.scale) }; }),
      candidates: SCALES.filter(x => x.layer !== 'outcomes' && x.read !== 'descriptive' && !s.proj.some(p => p.scale === x.id)).sort((a, b) => adj(a) - adj(b)).slice(0, 5).map(x => ({ label: x.label, level: fmt(x.r2), status: STAT(x)[0], add: () => A.addInit(x.id) })),
      canEdit: canAct, readOnly: !canAct, count: s.proj.length, onTrack: s.proj.filter(p => p.status === 'on').length, atRisk: s.proj.filter(p => p.status === 'risk').length, done: s.proj.filter(p => p.status === 'done').length,
      msDone: msAll.filter(m => m.done).length, msTotal: msAll.length, openActions: s.actions.filter(a => !a.done).length
    };
    develop.tabs = [['plan', 'Improvement plan'], ['focus', 'Focus areas and actions'], ['practices', 'Practices']].map(([id, l]) => Object.assign({ label: l, on: s.devTab === id, pick: () => A.set({ devTab: id }) }, sty('tab', s.devTab === id)));
    develop.planTab = s.devTab === 'plan';
    ['series', 'checkin', 'log', 'audit'].forEach(k => r[k] = R === 'meetings' && s.meetTab === k);
    meetings.tabs = [['series', 'Series and year'], ['agenda', 'Agenda'], ['live', 'Live meeting'], ['checkin', 'Check-in'], ['log', 'Decisions'], ['audit', 'Audit']].map(([id, l]) => Object.assign({ label: l, on: s.meetTab === id, pick: () => A.set({ meetTab: id }), dot: id === 'live' && s.live.started && !s.live.ended }, sty('tab', s.meetTab === id)));
    const MG = s.mtg, curIt = s.agenda[s.live.idx];
    const seI = it => it ? { pre: it.pre || 'none' } : { pre: 'none' };
    if (meetings.e && meetings.e.exists) { const it = s.agenda.find(x => x.id === s.sel); meetings.e.pres = [['none', 'Not needed'], ['needed', 'Waiting'], ['attached', 'Attached'], ['late', 'Arrived late']].map(([k, l]) => Object.assign({ label: l, pick: () => A.upd('pre', k) }, sty('chip', seI(it).pre === k))); meetings.e.preNote = seI(it).pre === 'none' ? 'No pre-read for this item.' : 'Deadline: Tuesday 09:00, 48 hours before the meeting. A late pre-read makes the item not ready.'; }
    const mx = {
      series: MG.series.map(sr => ({ name: sr.name, when: sr.when, len: sr.len, next: sr.next, purposes: sr.purposes.map(k => ({ label: PURPL[k] })) })),
      purpose: PURP.map(([k, l, want, now]) => ({ label: l, want: want + '%', now: now + '%', ww: (want / 40 * 100).toFixed(1) + '%', nw: (now / 40 * 100).toFixed(1) + '%', gap: Math.abs(want - now) >= 10 })),
      year: YEAR.map(([m, y, t]) => ({ label: m, year: y, topics: t.map(x => ({ text: x })), empty: !t.length })),
      ns: { name: MG.ns.name, setName: e => A.nsName(e.target.value), purposes: PURP.map(([k, l]) => Object.assign({ label: l, pick: () => A.nsPurpose(k) }, sty('chip', MG.ns.purposes.includes(k)))), add: A.addSeries, op: MG.ns.name.trim() && MG.ns.purposes.length ? '1' : '0.45' },
      roles: [['chair', 'Chair', 'Runs the agenda and closes each item'], ['time', 'Timekeeper', 'Calls the time box and the +5 minutes'], ['notes', 'Note-taker', 'Records decisions, owners and dates']].map(([k, l, d]) => { const p = person(MG.roles[k]); return { label: l, desc: d, name: p.name, initials: p.initials, abg: p.abg, afg: p.afg, opts: s.members.map(m => Object.assign({ label: m.initials, name: m.name, pick: () => A.setRoleM(k, m.id) }, sty('chip', MG.roles[k] === m.id))) }; }),
      canEdit: leader && !sample,
      heard: curIt ? !!MG.heard[curIt.id] : false, heardIcon: curIt && MG.heard[curIt.id] ? 'lucide:square-check' : 'lucide:square', toggleHeard: A.toggleHeard, isDecision: curIt ? curIt.type === 'Decision' : false,
      right: curIt ? ((s.charter.tasks.find(t => t.id === curIt.task) || {}).right || 'No decision right set') : '',
      parked: MG.parked.map(t => ({ text: t })), newPark: MG.newPark, setPark: e => A.setPark(e.target.value), addPark: A.addPark,
      ci: { open: s.live.ended, closed: !s.live.ended, answered: MG.ci.answered, mine: MG.ci.mine, canAnswer: s.live.ended && !MG.ci.mine && !coach, answer: () => A.startRun('checkin'), sim: A.simCheckin, canSim: s.live.ended, ready: s.live.ended && MG.ci.answered >= 4, notReady: !(s.live.ended && MG.ci.answered >= 4), need: Math.max(0, 4 - MG.ci.answered), items: ciMeans, dialogue: '3.6', worth: '3.4',
        hist: [['10 Sep', '3.1', '2.8', '3.0'], ['17 Sep', '3.2', '2.9', '3.1'], ['24 Sep', '3.4', '3.0', '3.2'], ['1 Oct', '3.5', '3.0', '3.3']].map(([d, a, b, c]) => ({ date: d, clear: a, focus: b, outcome: c })) },
      log: { decisions: s.agenda.filter(x => (s.live.decisions[x.id] || '').trim()).map(x => ({ date: 'Today', series: 'Weekly', text: s.live.decisions[x.id], owner: person(x.owner).name, isNew: true })).concat(DEC_LOG.map(([d, sr, t, o]) => ({ date: d, series: sr, text: t, owner: person(o).name, isNew: false }))),
        actions: s.actions.map(a => { const p = person(a.owner); return { text: a.text, owner: p.name, due: a.due, state: a.done ? 'Done' : 'Open', done: a.done }; }) },
      audit: { types: [['Information', 38, '5 h 10 min'], ['Discussion', 27, '3 h 40 min'], ['Decision', 22, '3 h 00 min'], ['Follow-up', 13, '1 h 45 min']].map(([l, p, t]) => ({ label: l, pct: p + '%', w: (p / 40 * 100).toFixed(1) + '%', time: t })),
        tasks: s.charter.tasks.map(t => ({ label: t.title, time: TASK_TIME[t.id] || 'New' })).concat([{ label: 'No team task', time: '1 h 50 min' }]),
        ready: [52, 58, 61, 70, 74, 79].map((v, k) => ({ v: v + '%', h: v + '%', label: ['Jul', 'Aug', 'Aug', 'Sep', 'Sep', 'Oct'][k] })),
        kpis: [['9', 'meetings in 3 months'], ['18%', 'of items needed no one but the owner'], ['6 of 9', 'started on time'], ['5 of 9', 'ended on time'], ['2.4', 'items carried over per meeting'], ['79%', 'items ready at the deadline']].map(([n, l]) => ({ n, label: l })) }
    };
    const rv = id => { const P = p3(id); const S = C360S[id] || (P.status === 'report' ? C360S._def : null); if (!S) return null; const R = P.raters;
      const shown = RG.filter(([g]) => g === 'mgr' ? R.mgr.n >= 1 : R[g].n >= 3); const pooledN = RG.filter(([g]) => g !== 'mgr' && R[g].n > 0 && R[g].n < 3).reduce((a, [g]) => a + R[g].n, 0);
      const totN = RG.reduce((a, [g]) => a + R[g].n, 0); const oth = C360.map((d, k) => RG.reduce((a, [g]) => a + (S[g] ? S[g][k] * R[g].n : 0), 0) / Math.max(1, totN));
      const dims = C360.map(([did, dl], k) => ({ id: did, label: dl, self: fmt(S.self[k]), others: fmt(oth[k]), sp: pct(S.self[k]), op: pct(oth[k]), gap: (S.self[k] - oth[k] >= 0 ? '+' : '−') + fmt(Math.abs(S.self[k] - oth[k])), groups: shown.map(([g, gl]) => ({ label: gl, v: fmt(S[g][k]) })), pooled: pooledN >= 3 ? fmt(oth[k]) : '' }));
      const items = []; C360.forEach(([did, dl, its], k) => its.forEach((t, j) => items.push({ text: t, dim: dl, v: clamp(oth[k] + C360_OFF[j]) })));
      items.sort((a, b) => b.v - a.v);
      return { dims, shown: shown.map(([g, gl]) => ({ label: gl, n: R[g].n, note: g === 'mgr' ? 'Shown by role, not anonymous' : 'Anonymous, ' + R[g].n + ' raters' })), pooledNote: pooledN > 0 ? pooledN + ' answer' + (pooledN === 1 ? '' : 's') + ' from groups under 3 count only in the overall average' : '', hasPooled: pooledN > 0, totN,
        blind: dims.filter((d, k) => S.self[k] - oth[k] >= 0.4).map(d => ({ label: d.label, text: 'You ' + d.self + ' · others ' + d.others })), hidden: dims.filter((d, k) => oth[k] - S.self[k] >= 0.4).map(d => ({ label: d.label, text: 'You ' + d.self + ' · others ' + d.others })),
        top: items.slice(0, 5).map(x => ({ text: x.text, dim: x.dim, v: fmt(x.v) })), low: items.slice(-5).reverse().map(x => ({ text: x.text, dim: x.dim, v: fmt(x.v) })), themes: C360_OPEN.map((q, k) => ({ q, items: (S.themes[k] || []).map(([t, n]) => ({ text: t, n: n + ' mentions', w: (n / 10 * 100).toFixed(1) + '%' })) })) }; };
    const myId = me.id, myP = p3(myId), myR = myP.raters;
    const rep0 = rv(myId);
    const cx = {
      tabs: [['mine', 'My 360'], ['rate', 'Give feedback'], ['team', 'The group'], ['model', 'The model']].map(([id, l]) => Object.assign({ label: l, on: c3.tab === id || (id === 'team' && c3.tab === 'view'), pick: () => A.c360Tab(id) }, sty('tab', c3.tab === id || (id === 'team' && c3.tab === 'view')))),
      mine: c3.tab === 'mine', rate: c3.tab === 'rate', team: c3.tab === 'team', model: c3.tab === 'model', view: c3.tab === 'view',
      status: ST3[myP.status], none: myP.status === 'none', nominate: myP.status === 'nominate', collecting: myP.status === 'collecting', report: myP.status === 'report' && !!rep0,
      steps: [['nominate', 'Choose raters'], ['self', 'Rate yourself'], ['collecting', 'Collect answers'], ['report', 'Read the report'], ['dev', 'Plan your development']].map(([k, l], j) => { const at = { none: -1, nominate: 0, collecting: 2, report: 3 }[myP.status]; const idx = k === 'self' ? (myP.selfDone ? 1 : (at >= 0 ? at : -1)) : j; const done = j < at || (k === 'self' && myP.selfDone); return { n: j + 1, label: l, bar: done ? (T.stepDone || '#333') : j === at ? (T.stepCur || '#999') : T.dotOff, fg: j <= at || done ? (T.ink || '#111') : (T.muted || '#777') }; }),
      start: A.c360Start, launch: A.c360Launch, sim: A.c360Sim, close: A.c360Close, share: A.c360Share, shared: !!myP.shared, shareLabel: myP.shared ? 'Shared with the group · stop sharing' : 'Share a summary with the group',
      selfDone: !!myP.selfDone, selfTodo: !myP.selfDone && (myP.status === 'nominate' || myP.status === 'collecting'), rateSelf: () => A.startRun('c360', myId),
      groups: RG.map(([g, gl]) => { const r = myR[g]; return { key: g, label: gl, n: r.n, of: r.of, pct: (r.n / Math.max(1, r.of) * 100).toFixed(1) + '%', rule: g === 'mgr' ? 'Shown by role · 0 to 2' : 'Anonymous · 3 or more, or none', ok: g === 'mgr' ? true : (r.of === 0 || r.of >= 3), warn: g !== 'mgr' && r.of > 0 && r.of < 3, thr: g === 'mgr' ? (r.n >= 1 ? 'Shown' : 'Waiting') : r.n >= 3 ? 'Shown as a group' : r.n > 0 ? 'Pooled until 3' : r.of ? 'Waiting' : 'Not used', inc: () => A.c360Adj(g, 1), dec: () => A.c360Adj(g, -1) }; }),
      totN: RG.reduce((a, [g]) => a + myR[g].n, 0), totOf: RG.reduce((a, [g]) => a + myR[g].of, 0),
      r: rep0 || { dims: [], shown: [], blind: [], hidden: [], top: [], low: [], themes: [] },
      hasBlind: rep0 ? rep0.blind.length > 0 : false, hasHidden: rep0 ? rep0.hidden.length > 0 : false,
      dev: C360.map(([did, dl]) => ({ label: dl, keepOn: c3.dev.keep.includes(did), growOn: c3.dev.grow.includes(did), keep: () => A.c360Dev('keep', did), grow: () => A.c360Dev('grow', did), kb: sty('chip', c3.dev.keep.includes(did)), gb: sty('chip', c3.dev.grow.includes(did)) })).map(x => Object.assign(x, { kbg: x.kb.bg, kfg: x.kb.fg, kbd: x.kb.bd, gbg: x.gb.bg, gfg: x.gb.fg, gbd: x.gb.bd })),
      devSummary: (c3.dev.keep.map(id => C360.find(d => d[0] === id)[1]).join(', ') || 'nothing yet') + ' to keep · ' + (c3.dev.grow.map(id => C360.find(d => d[0] === id)[1]).join(', ') || 'nothing yet') + ' to grow',
      toRate: s.members.filter(m => m.id !== myId && p3(m.id).status === 'collecting').map(m => { const done = c3.rated.includes(m.id); return Object.assign({ name: m.name, role: m.role, initials: m.initials, done, todo: !done && !coach && !sample, state: done ? 'Sent' : 'Waiting for you', go: () => A.startRun('c360', m.id) }, av(m.tone)); }),
      noRate: !s.members.some(m => m.id !== myId && p3(m.id).status === 'collecting'),
      people: s.members.map(m => { const P = p3(m.id); const n = RG.reduce((a, [g]) => a + P.raters[g].n, 0), of = RG.reduce((a, [g]) => a + P.raters[g].of, 0); const can = m.id !== myId && P.status === 'report' && P.shared; return Object.assign({ name: m.name, role: m.role, initials: m.initials, status: ST3[P.status], progress: P.status === 'collecting' ? n + ' of ' + of + ' answered' : P.status === 'report' ? (P.shared ? 'Summary shared' : 'Private') : '—', canSee: can, see: () => A.c360See(m.id), isMe: m.id === myId }, av(m.tone)); }),
      modelDims: C360.map(([did, dl, its]) => ({ label: dl, items: its.map(t => ({ text: t })) })), open: C360_OPEN.map(t => ({ text: t })),
      vName: (mem(c3.view) || { name: '' }).name, vr: (c3.view !== myId && p3(c3.view).shared && rv(c3.view)) || { dims: [], themes: [] }, back: () => A.c360Tab('team'),
      notCoach: !coach, sample
    };
    // v5: forum optimisations
    const onAg = p => s.agenda.some(a => a.proj === p.id);
    pv.items.forEach((it, k) => { const p = s.proj[k]; it.onAgenda = onAg(p); it.notOnAgenda = !onAg(p) && canAct; it.toAgenda = () => A.projToAgenda(p.id); });
    const preWait = s.agenda.filter(a => a.pre === 'needed' || a.pre === 'late').length;
    const totMin = s.agenda.reduce((x, a) => x + a.minutes, 0), infoMin = s.agenda.filter(a => a.type === 'Information').reduce((x, a) => x + a.minutes, 0);
    mx.fit = { planned: totMin, over: totMin > 90, fits: totMin <= 90, overText: (totMin - 90) + ' min over the slot', leftText: (90 - totMin) + ' min left', w: Math.min(100, totMin / 90 * 100).toFixed(1) + '%', info: Math.round(infoMin / Math.max(1, totMin) * 100) + '%', infoHigh: infoMin / Math.max(1, totMin) > 0.25, preWait, decisions: s.agenda.filter(a => a.type === 'Decision').length,
      sugg: s.proj.filter(p => !onAg(p) && p.status !== 'done').map(p => ({ title: p.title, status: (PST[p.status] || PST.todo)[0], add: () => A.projToAgenda(p.id) })), hasSugg: canAct && s.proj.some(p => !onAg(p) && p.status !== 'done') };
    const toRateN = cx.toRate.filter(x => !x.done).length;
    home.week = [
      { icon: 'lucide:calendar-clock', label: 'Thursday meeting', value: meetings.readyCount + ' of ' + meetings.total + ' ready', sub: preWait ? preWait + ' pre-read' + (preWait === 1 ? '' : 's') + ' waiting' : 'All pre-reads in', go: () => A.set({ route: 'meetings', meetTab: 'agenda' }) },
      { icon: 'lucide:kanban', label: 'Improvement plan', value: pv.onTrack + ' on track', sub: pv.atRisk + ' at risk · ' + pv.msDone + ' of ' + pv.msTotal + ' milestones', go: () => A.set({ route: 'develop', devTab: 'plan' }) },
      { icon: 'lucide:activity', label: 'Pulse 6', value: s.pulse.answered + ' of ' + s.pulse.of, sub: s.pulseMine ? 'You answered · closes Wed' : 'Waiting for you · 2 min', go: () => s.pulseMine ? A.set({ route: 'assess', assessTab: 'pulse' }) : A.startRun('pulse') },
      { icon: 'lucide:message-circle-question', label: 'Meeting check-in', value: s.live.ended ? (s.mtg.ci.mine ? 'Answered' : 'Open') : 'After the meeting', sub: s.live.ended ? s.mtg.ci.answered + ' answered' : 'Opens when the meeting closes', go: () => A.set({ route: 'meetings', meetTab: 'checkin' }) },
      { icon: 'lucide:radar', label: 'CXO 360', value: toRateN + ' to rate', sub: 'My 360: ' + cx.status, go: () => { s.c360.tab = toRateN ? 'rate' : 'mine'; A.go('cxo'); } }
    ];
    const lowAgL = SCALES.filter(x => x.ag === 'low').map(x => x.label), prioL = stRows.filter(x => x.status === 'Priority').map(x => x.label);
    results.st.session = [['10 min', 'Open', 'Purpose of the session and two ground rules: talk about the team, not about who answered. Disagreement is information.'], ['10 min', 'The outcomes', 'Direction, alignment and commitment, viability and member growth. What do we notice first?'], ['30 min', 'Layer by layer', 'Reveal conditions, then processes, then states. Name one strength and one question per layer.'], ['15 min', 'Where our views differ', lowAgL.length ? lowAgL.join(', ') + '. Ask what each person sees before anyone suggests a fix.' : 'No scale has low agreement this round.'], ['15 min', 'Choose up to 2 focus areas', prioL.length ? 'Priorities this round: ' + prioL.join(', ') + '.' : 'No priority scales. Choose what matters most.'], ['10 min', 'Actions and owners', 'Each focus area gets an initiative in the plan, an owner and a first milestone.']].map(([t, l, x], k) => ({ n: k + 1, time: t, label: l, text: x }));
    results.st.dl = () => A.toastMsg('Prototype: slides and a PDF report for round 2 would download here');
    results.st.meas = [['Validation pilot', '18 of 40 leadership teams'], ['Reliability per scale', 'Published when 40 teams are in'], ['Agreement statistic', 'rwg, shown only as a label'], ['Versions', 'Full diagnostic v1.2 · charter v3']].map(([a, b]) => ({ label: a, text: b }));
    cx.pdf = () => A.toastMsg('Prototype: your private 360 report would download as a PDF');
    cx.coach = () => A.toastMsg('Prototype: report shared with your coach, Anne Vik. You can withdraw at any time.');
    if (s.lpScores[w]) { meV.domains = meV.domains.map((d, k) => Object.assign({}, d, { pos: s.lpScores[w][k] + '%', band: band(s.lpScores[w][k]) })); meV.test = lvl === 'lpq' ? 'Quick profile, Mini-IPIP · 20 items · completed today' : 'Full profile · completed today'; }
    meV.take = () => A.startRun('lpq'); meV.takeFull = () => A.startRun('lpf');
    let run = { open: false, secs: [], privacy: [], q: { opts: [] } };
    if (s.run) {
      const R = s.run; const def = buildRun(s, R.id, R.target); const c = CATM[R.id] || { name: 'Assessment', icon: 'lucide:clipboard-list', min: 5 };
      const flat = []; def.secs.forEach((sec, si) => sec.items.forEach(it => flat.push(Object.assign({ si }, it))));
      const idx = Math.min(R.idx, Math.max(0, flat.length - 1)); const cur = flat[idx] || { text: '', si: 0 }; const a = R.ans[idx];
      const isAns = k => R.ans[k] != null && R.ans[k] !== '';
      const answeredN = flat.filter((f, k) => isAns(k)).length; const missing = flat.filter((f, k) => !f.open && !isAns(k)).length;
      const prev = R.phase === 'done' ? !!R.preview : isPreview(s, R);
      const tm = R.target ? mem(R.target) : null; const tname = tm ? tm.name : '';
      const back = () => { A.runExit(); A.set({ route: 'assess', assessTab: 'overview' }); };
      const rdn = s.rounds.find(x => x.type === R.id && x.mine && (x.status === 'open' || x.status === 'closed'));
      const DT = prev ? ['Preview finished', 'Nothing was saved. This is exactly what members see when a round is open.', 'Close', () => A.runExit()]
        : (R.id === 'lpq' || R.id === 'lpf') ? ['Your profile is ready', 'Private to you. Sharing stays at ' + SHARE_L[s.share[w]] + ' until you change it.', 'See my profile', () => { A.runExit(); A.go('me'); }]
        : R.id === 'tlf' ? (member ? ['Thanks, your rating is in', 'Anonymous. Kari sees averages only when 4 or more have rated. ' + s.tlf.raters + ' have rated so far.', 'See where we stand', back] : ['Self-rating saved', 'It shows as a tick next to the group average once 4 have rated.', 'See where we stand', back])
        : R.id === 'cv' ? ['Rating for ' + tname + ' is in', 'Only ' + tname.split(' ')[0] + ' sees the averages, and only at 4 raters.', 'Rate another colleague', () => { A.runExit(); A.set({ route: 'assess', assessTab: 'tests' }); }]
        : R.id === 'checkin' ? ['Check-in sent', 'Anonymous. ' + s.mtg.ci.answered + ' have answered. Results show at 4.', 'See the check-in', () => { A.runExit(); A.set({ route: 'meetings', meetTab: 'checkin' }); }]
        : R.id === 'c360' ? (R.target === me.id ? ['Self-rating saved', 'It shows next to how others see you, once your report is ready.', 'Back to my 360', () => { A.runExit(); A.go('cxo'); }] : ['Your feedback for ' + tname + ' is in', 'Anonymous within the peer group. Only ' + tname.split(' ')[0] + ' sees the report.', 'Back to 360', () => { A.runExit(); A.set({ route: 'cxo', c360: Object.assign(s.c360, { tab: 'rate' }) }); }])
        : R.id === 'pulse' ? ['Pulse answered', s.pulse.answered + ' of ' + s.pulse.of + ' have answered. The trend updates when the pulse closes.', 'See where we stand', back]
        : ['Your answers are in', (rdn ? rdn.answered + ' of ' + rdn.of + ' have answered. ' : '') + 'Nobody can see who. Everyone gets the results at the same moment.', 'See where we stand', back];
      run = {
        open: true, name: c.name + (tname ? ' · ' + tname : ''), icon: c.icon, purpose: c.purpose || '', min: c.min, meta: flat.length + ' items · about ' + c.min + ' min' + (prev ? ' · preview, nothing is saved' : ''),
        intro: R.phase === 'intro', inQ: R.phase === 'q', review: R.phase === 'review', done: R.phase === 'done', preview: prev,
        total: flat.length, answered: answeredN, pctAll: (answeredN / Math.max(1, flat.length) * 100).toFixed(1) + '%', lead: def.lead, privacy: def.privacy.map(t => ({ text: t })), secCount: def.secs.length,
        secs: def.secs.map((sec, si) => { const ks = flat.map((f, k) => f.si === si ? k : -1).filter(k => k >= 0); const dn = ks.filter(isAns).length; const on = cur.si === si && R.phase === 'q'; return Object.assign({ n: si + 1, title: sec.title, count: ks.length, done: dn, fill: (dn / Math.max(1, ks.length) * 100).toFixed(1) + '%', grow: String(Math.max(1, ks.length)), mark: dn === ks.length ? 'lucide:circle-check' : on ? 'lucide:circle-dot' : 'lucide:circle', jump: () => A.runJump(ks[0] || 0) }, sty('card', on)); }),
        start: A.runStart, startLabel: answeredN > 0 ? 'Resume at item ' + (idx + 1) : 'Start',
        q: { n: idx + 1, text: cur.text, tag: cur.tag || '', hasTag: !!cur.tag, isOpen: !!cur.open, likert: !cur.open, sec: (def.secs[cur.si] || {}).title || '', secN: cur.si + 1, secSub: (def.secs[cur.si] || {}).sub || '', opts: def.opts.map((l, k) => Object.assign({ label: l, n: k + 1, pick: () => A.runAnswer(k + 1) }, sty('opt', a === k + 1))), answer: typeof a === 'string' ? a : '', setAnswer: e => A.runText(e.target.value) },
        back: A.runBack, next: A.runNext, nextLabel: idx === flat.length - 1 ? 'Review answers' : 'Next', nextOp: (cur.open || isAns(idx)) ? '1' : '0.45', backOp: idx > 0 ? '1' : '0.35',
        fill: A.runFill, exit: A.runExit, exitLabel: R.phase === 'done' ? 'Close' : 'Save and exit', submit: A.runSubmit, missing, hasMissing: missing > 0, submitOp: missing ? '0.45' : '1',
        toFirstMissing: () => { const k = flat.findIndex((f, j) => !f.open && !isAns(j)); if (k >= 0) A.runJump(k); },
        doneTitle: DT[0], doneText: DT[1], doneCta: DT[2], doneGo: DT[3]
      };
    }
    const current = R === 'assess' ? s.assessTab : (R === 'people' && s.peopleTab === 'person') ? 'person' : R;
    const proto = {
      open: s.protoOpen, closed: !s.protoOpen, toggle: A.protoToggle, reset: A.reset,
      roles: [['leader', 'Leader'], ['member', 'Member'], ['coach', 'Coach']].map(([k, l]) => Object.assign({ label: l, on: role === k, pick: () => A.setRole(k) }, PROTO[role === k ? 'on' : 'off'])),
      plans: [['free', 'Free'], ['team', 'Team plan']].map(([k, l]) => Object.assign({ label: l, on: s.plan === k, pick: () => A.setPlan(k) }, PROTO[s.plan === k ? 'on' : 'off'])),
      layouts: [['horizontal', 'Horizontal menu'], ['vertical', 'Vertical menu']].map(([k, l]) => Object.assign({ label: l, on: s.ui.nav === k, pick: () => A.setNav(k) }, PROTO[s.ui.nav === k ? 'on' : 'off'])),
      widths: [[false, 'Contained'], [true, 'Full width']].map(([k, l]) => Object.assign({ label: l, on: s.ui.wide === k, pick: () => A.setWide(k) }, PROTO[s.ui.wide === k ? 'on' : 'off'])),
      screens: SCREENS.map(([k, l]) => Object.assign({ label: l, on: current === k, pick: () => A.jump(k) }, PROTO[current === k ? 'on' : 'off'])),
      summary: roleLabel + ' · ' + (free ? 'Free' : 'Team plan')
    };

    if (T.viz) {
      const SDm = { high: .55, medium: .8, low: 1.1 }, RW = { high: .82, medium: .64, low: .41 };
      const ciOf = x => 1.96 * SDm[x.ag] / Math.sqrt(8);
      const hi = SCALES.filter(x => x.layer !== 'outcomes' && x.read === 'higher');
      const idx2 = mean(hi.map(x => x.r2)), idx1 = mean(hi.map(x => x.r1)), idxV = rnd === 1 ? idx1 : idx2;
      const GR = [['Purpose', ['purpose', 'teamTasks']], ['Meetings', ['preparation', 'meetingGoals', 'focus']], ['Dialogue', ['dialogue', 'taskConflict']], ['One team', ['integration', 'info', 'external']], ['Safety', ['safety', 'trust', 'cohesion']], ['Results', ['dac', 'viability', 'growth']]];
      const g1 = GR.map(g => mean(g[1].map(id => SC[id].r1))), g2 = GR.map(g => mean(g[1].map(id => SC[id].r2)));
      const cx = 190, cy = 175, RR = 140;
      const pt = (v, k, extra) => { const a = -Math.PI / 2 + k * Math.PI / 3, r = (v - 1) / 4 * RR + (extra || 0); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      const poly = vs => vs.map((v, k) => pt(v, k).map(n => n.toFixed(1)).join(',')).join(' ');
      const lyr = SCALES.filter(x => s.res.layer === 'all' ? x.layer !== 'outcomes' : x.layer === s.res.layer);
      const W = 420, XP = v => (Math.max(1, Math.min(5, v)) - 1) / 4 * W;
      const nonOut2 = SCALES.filter(x => x.layer !== 'outcomes');
      const mx = v => 50 + (Math.max(1.5, Math.min(4.5, v)) - 1.5) / 3 * 480, my = r => 330 - (r - .3) / .65 * 300;
      const spread = arr => { const P = arr.map(p => ({ p, x: +p.cx, y: +p.cy })); for (let it = 0; it < 80; it++) { let moved = false; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, d = Math.hypot(dx, dy) || 0.01; if (d < 20) { const push = (20 - d) / 2, ux = d > 0.01 ? dx / d : Math.cos(j), uy = d > 0.01 ? dy / d : Math.sin(j); P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push; moved = true; } } if (!moved) break; } return P.map(q => Object.assign({}, q.p, { cx: Math.max(60, Math.min(530, q.x)).toFixed(1), cy: Math.max(40, Math.min(320, q.y)).toFixed(1), pl: (Math.max(60, Math.min(530, q.x)) / 580 * 100).toFixed(2) + '%', pt: (Math.max(40, Math.min(320, q.y)) / 380 * 100).toFixed(2) + '%' })); };
      results.viz = {
        tiles: [
          { bg: (T.vizTiles || [])[0] || '#111111', fg: '#ffffff', label: 'Team index', value: fmt(idxV), sub: (rnd === 1 ? 'Round 1 baseline' : chg2(idx2 - idx1) + ' since round 1') + ' · 95% CI ±0.2' },
          { bg: (T.vizTiles || [])[1] || '#cccbdc', fg: T.vizInk || '#111111', label: 'Agreement across 21 scales', value: cnt.high + ' high', sub: cnt.medium + ' medium · ' + cnt.low + ' views differ' },
          { bg: (T.vizTiles || [])[2] || '#c3e1e6', fg: T.vizInk || '#111111', label: 'Reliability', value: 'α .82', sub: 'ω .84 · all scales above .70' },
          { bg: (T.vizTiles || [])[3] || '#fdea8a', fg: T.vizInk || '#111111', label: 'Response', value: '8 of 8', sub: 'ICC(1) .21 · ICC(2) .68' }
        ],
        agBar: [{ f: String(cnt.high), c: T.vizInk || '#111111' }, { f: String(cnt.medium), c: T.vizMid || '#8a87b3' }, { f: String(cnt.low), c: '#ffffff' }],
        radar: {
          rings: [2, 3, 4, 5].map(v => ({ p: poly([v, v, v, v, v, v]) })),
          axes: GR.map((g, k) => { const [x2, y2] = pt(5, k), [lx, ly] = pt(5, k, 22); return { x2: x2.toFixed(1), y2: y2.toFixed(1), lx: lx.toFixed(1), ly: ly.toFixed(1), pl: (lx / 380 * 100).toFixed(2) + '%', pt: (ly / 360 * 100).toFixed(2) + '%', label: g[0] }; }),
          p1: poly(g1), p2: poly(rnd === 1 ? g1 : g2), dots: (rnd === 1 ? g1 : g2).map((v, k) => { const [x, y] = pt(v, k); return { x: x.toFixed(1), y: y.toFixed(1) }; }),
          rows: GR.map((g, k) => ({ label: g[0], r1: fmt(g1[k]), r2: fmt(g2[k]), change: chg2(g2[k] - g1[k]) })), showR1: rnd === 2
        },
        dots: lyr.map(x => { const m = lv(x), ci = ciOf(x), cn = dist(m, x.ag); const ds = []; cn.forEach((n, j) => { for (let i = 0; i < n; i++) ds.push({ left: (XP(j + 1) - 5 + (i - (n - 1) / 2) * 11).toFixed(1) + 'px' }); });
          return { label: x.label, mean: fmt(m), ciText: '±' + ci.toFixed(2), agree: AG[x.ag], differ: x.ag === 'low', agFg: x.ag === 'low' ? (T.vizLow || '#c0502e') : (T.vizMuted || '#55524a'), bandL: XP(m - ci).toFixed(1) + 'px', bandW: (ci * 2 / 4 * W).toFixed(1) + 'px', meanL: (XP(m) - 1.5).toFixed(1) + 'px', dots: ds, open: () => A.openScale(x.id) }; }),
        trackW: W + 'px',
        matrix: {
          lx: mx(3.2).toFixed(1), ly: my(.6).toFixed(1), lw: (mx(3.2) - 50).toFixed(1), lh: (my(.6) - 30).toFixed(1),
          pts: spread(nonOut2.map((x, k) => { const r = RW[x.ag] + ((k * 53) % 17 - 8) / 100; const v = lv(x); const fix = x.read === 'lower' ? 6 - v : v; return { cx: mx(fix).toFixed(1), cy: my(r).toFixed(1), tx: (mx(fix) + 10).toFixed(1), ty: (my(r) + 4).toFixed(1), pl: (mx(fix) / 580 * 100).toFixed(2) + '%', pt: (my(r) / 380 * 100).toFixed(2) + '%', r: x.ev === 'Strong' ? '8' : '5.5', fill: fix < 3.2 ? (T.vizLow || '#e07049') : (T.vizMid || '#8a87b3'), label: String(k + 1), name: x.label }; })),
          legend: nonOut2.map((x, k) => ({ n: String(k + 1), name: x.label, fill: ((x.read === 'lower' ? 6 - lv(x) : lv(x)) < 3.2) ? (T.vizLow || '#e07049') : (T.vizMid || '#8a87b3') })),
          groups: [
            { bg: (T.vizGroups || [])[0] || '#fdea8a', title: 'Fix together', list: nonOut2.filter(x => (x.read === 'lower' ? 6 - lv(x) : lv(x)) < 3.2 && x.ag !== 'low').map(x => x.label).join(', ') || 'None', text: 'Low level and you agree on it. Pick a practice.' },
            { bg: (T.vizGroups || [])[1] || '#cccbdc', title: 'Talk first', list: nonOut2.filter(x => x.ag === 'low').map(x => x.label).join(', ') || 'None', text: 'Views differ. Discuss the split before choosing a fix.' },
            { bg: (T.vizGroups || [])[2] || '#c3e1e6', title: 'Keep', list: nonOut2.filter(x => (x.read === 'lower' ? 6 - lv(x) : lv(x)) >= 3.6 && x.ag === 'high').map(x => x.label).slice(0, 3).join(', ') + (nonOut2.filter(x => (x.read === 'lower' ? 6 - lv(x) : lv(x)) >= 3.6 && x.ag === 'high').length > 3 ? ' +' + (nonOut2.filter(x => (x.read === 'lower' ? 6 - lv(x) : lv(x)) >= 3.6 && x.ag === 'high').length - 3) + ' more' : ''), text: 'Strong and shared. Protect what works.' }
          ]
        }
      };
    }
    if (T.tints) { const tn = T.tints; if (Array.isArray(home.week)) home.week = home.week.map((x, k) => Object.assign({}, x, { tint: tn[k % tn.length] })); if (Array.isArray(develop.practices)) develop.practices = develop.practices.map((x, k) => Object.assign({}, x, { bg: x.sel ? x.bg : tn[k % tn.length], bd: x.sel ? x.bd : tn[k % tn.length] })); }
    return {
      ready: true, r, nav, gate, me, roleLabel, isLeader: leader, isMember: member, isCoach: coach, notCoach: !coach, free, paid,
      groupName: s.save.groupName || 'Lumio leadership group', planLabel: free ? 'Free plan' : 'Team plan',
      go: { landing: () => A.go('landing'), scan: A.startScan, home: () => A.go(coach ? 'group' : 'home'), group: () => A.go('group'), results: () => A.go('results'), develop: () => A.go('develop'), meetings: () => A.go('meetings'), me: () => A.go('me'), team: () => A.go('team'), invite: () => A.go('invite'), signIn: () => A.go(coach ? 'group' : 'home'), settings: () => A.go('settings'), plan: () => A.goPlan() },
      scan, personal, invite, team, upgrade, results, meetings, live, home, group, develop, meV,
      ui, people, assess, run, settings, pv, mx, cx, toast: { show: !!s.toast, text: s.toast || '' }, proto
    };
  }

  window.LTCore = { createStore, view };
  try { window.dispatchEvent(new Event('ltcore-ready')); } catch (e) {}
})();
