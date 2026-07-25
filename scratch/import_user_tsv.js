require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const rawTable = `232	FABTEX	REYON	172	370.5	366	403																			366	10.98	-6.48
233	OZONE	SUDARSHAN		120	116.5	404																			116.5	3.495	0.005
234	OZONE	SUDARSHAN	280	1544.7																					0	0	1544.7
235	FABTEX	CREPE 58"	172	942.25	940	419																			940	28.2	-25.95
236	FABTEX	CEMBRIC	172	1212	1280	418																			1280	38.4	-106.4
236	FABTEX	CREPE 58"	173	2024.75	198.25	419	619.25	420	607.5	421	604.5	424	5	425	291	426									2325.5	69.765	-370.515
237	OZONE	MALAY	1991	1016.5																					0	0	1016.5
237	OZONE	POWDER	1991	1035																					0	0	1035
238	FABTEX	MAL 58"	174	761.75	448	430	175	14	275	13															898	26.94	-163.19
239	FABTEX	LAICRA	174	277	259	429																			259	12.95	5.05
240	FABTEX	CREPE 58"	175	2079	31.75	431	387	436	287.25	447	620.25	449	428	450	320	452									2074.25	62.2275	-57.4775
241	FABTEX	CEMBRIC	175	303	266	428	37	RETURN 																	303	9.09	-9.09
242	FABTEX	REYON	175	52	52.5	433																			52.5	1.575	-2.075
243	MAHAGAURI	LINEN 58	25	1018.25	706	439																			706	21.18	291.07
243	MAHAGAURI	LINEN 36	25	922	812	440																			812	24.36	85.64
244	FABTEX	MAL 58"	176	1710	312	442	406.75	15	878.75	457															1597.5	47.925	64.575
245	FABTEX	CEMBRIC	177	550.25	466.75	448																			466.75	14.0025	69.4975
246	FABTEX	REYON	177	148	142.25	447																			142.25	4.2675	1.4825
247	FABTEX	CREPE 58"	178	2539	522.25	452	1211	455	800	456															2533.25	75.9975	-70.2475
248	OZONE	SUDARSHAN	2285	766.25	388	469	193.5	470	169	529															750.5	22.515	-6.765
249	FABTEX	CREPE 58"	179	2303.5	526.5	456	1265.5	459	630.25	463															2422.25	72.6675	-191.4175
250	FABTEX	CREPE 44"	180	104	101.5	458																			101.5	3.045	-0.545
251	OEQUAL	JHOOTH		557.2	520.25	471																			520.25	15.6075	21.3425
252	ELITE	MAL 58"	728	2657	223.75	460	650.5	16	100.5	17	184.25	19	224.75	468	177.5	479	337	20	413.25	21					2311.5	69.345	276.155
253	ELITE	REYON	728	71	68.25	454																			68.25	2.0475	0.7025
254	FABTEX	CREPE 58"	180	2876	599.25	465	347.5	464	252.75	484	422	485	364.75	486	377	487	504.75	488							2868	86.04	-78.04
255	FABTEX	CREPE 44"	183	257.75	254.5	466																			254.5	7.635	-4.385
256	FABTEX	SUMMER COOL	183	753.75	175	526	75.75	543																	250.75	7.5225	495.4775
257	FABTEX	SUMMER COOL	182	2350.5	629.5	473	325.25	475	1063.5	474	33	498	300	526											2351.25	70.5375	-71.2875
258	ELITE	CEMBRIC	730	160.75	154.25	477																			154.25	4.6275	1.8725
259	ELITE	LINEN FLEX	320	663.5	371.75	472																			371.75	11.1525	280.5975
260	ELITE	CEMBRIC	740	161	155	477																			155	4.65	1.35
261	FABTEX	REYON	184	178.5	94	476																			94	2.82	81.68
262	FABTEX	CEMBRIC	185	2020	1243	480	22.5	490	697	493															1962.5	58.875	-1.375
263	OZONE	WHITE JHOOTH	2447	26	25.5	483																			25.5	0.765	-0.265
264	FABTEX	CREPE 58"	186	2346.5	460.75	491	753.5	495	193	496	58	502	834.82	508											2300.07	69.0021	-22.5721
265	FABTEX	CREPE 44"	186	353.5	313.75	487	17	510																	330.75	9.9225	12.8275
266	OZONE	POWDER	2568	3139.25	3229.75	RETURN																			3229.75	96.8925	-187.3925
267	OZONE	SUDARSHAN	2551	1005.5	336	529																			336	10.08	659.42
268	ELITE	MAL 58"	801	2216	830.5	501	571	494	240.25	492	653.75	505													2295.5	68.865	-148.365
269	ELITE	REYON	807,805	158.5	146.75	499																			146.75	4.4025	7.3475
270	ELITE	CREPE 44"	806	910	861.75	500																			861.75	25.8525	22.3975
271	ELITE	CEMBRIC	805	335.5	306.25	503																			306.25	9.1875	20.0625
272	FABTEX	CREPE 58"	187	986.5	966	508																			966		
273	FABTEX	CEMBRIC	188	2073	1977.25	509																			1977.25		
274	ELITE	MAL 58"	809	1008.5	466.5	519	223.5	520	525	361															1215		
275	FABTEX	CREPE 58"	189	1419.25	599.5	508		510	821.25	511															1420.75		
276	ELITE	CREPE 58"	810	156.5	148	506																			148		
	ELITE	CREPE 44"	810	101.25	67.75																				67.75		
	ELITE	MAL 58"	810	230	210	521																			210		
277	FABTEX	CREPE 58"	190	1998.25	1246.25	515	629.25	517																	1875.5		
278	FABTEX	CREPE 44"	190	363.75	358	507																			358		
279	OZONE	MALAY	2704	219.5	65	514																			65		
280	ELITE	MAL 58"	818	2330	500	512	439	522	508.5	523	505	537													1952.5		
281	FABTEX	CREPE 44"	191	363.5	352.5	534																			352.5		
282	ELITE	MAL 58"	823	1070	1032.25	524																			1032.25		
283	ELITE	CREPE 58"	820	2129.5	1218.75	518	559	519																	1777.75		
284	FABTEX	CREPE 58"	192	2555	2545.5	528																			2545.5		
285	FABTEX	REYON	192	249	359.25	527																			359.25		
286	FABTEX	REYON	195	134.75	3	536	7	539																	10		
287	FABTEX	CREPE 44"	533	1109.25	1094.5	533																			1094.5		
288	G	G																							0		
289	FABTEX	CREPE 58"	193	934	915	532																			915		
290	FABTEX	CREPE 58"	196	2345.75	386	532	686.5	541	603.25	545															1675.75		
291	ELITE	MAL 58"	832	2601	1603	548	793	549																	2396		
292	OZONE 	ARMANI 44"	2854	96																					0	0	96
293	ELITE	CREPE 58"	838	1479	1345	546	5.25	602	14	611															1364.25	40.9275	73.8225
294	ELITE	MAL 58"	838	1062.25	404	552	579.25	561																	983.25	29.4975	49.5025
295	ELITE	MAL 58"	839	1516	590	562	989	564																	1579	47.37	-110.37
296	OZONE 	JHOOTH	2908	2838.25	229	594	97	595																	326	9.78	2502.47
297	OZONE 	SUDARSHAN	2909	1142.25																					0	0	1142.25
298	FABTEX	CREPE 58"	198	2430	1860	550	521	551																	2381	71.43	-22.43
299	FABTEX	CREPE 58"	199	2539.5	741.75	551	1746.5	553																	2488.25	74.6475	-23.3975
300	FABTEX	CREPE 58"	200	2197.5	173	553	1173.75	554	941	556															2287.75	68.6325	-158.8825
301	FABTEX	REYON	197	41																					0	0	41
302	ELITE	CREPE 58"	843	2807.75	1290.5	555	1136.25	556	324	590															2750.75	82.5225	-25.5225
303	ELITE	CEMBRIK 	844	626	601.25	558																			601.25	18.0375	6.7125
304	ELITE	CEMBRIK 	845	1208.75	457.5	560	189.75	559	260.75	565	327.75	560													1235.75	37.0725	-64.0725
305	AVSAR	MAL 58"	200	4832.25	291.25	571	630.5	580	815.5	581	577.75	582													2315	69.45	2447.8
306	FABTEX	CREPE 44"	201	1079	548.25	568																			548.25	16.4475	514.3025
307	FABTEX	REYON	202	111.5	114	567																			114	3.42	-5.92
308	FABTEX	CREPE 58"	203	2204.5	702	570	754.5	569	379.25	572	280.75	574													2116.5	63.495	24.505
309	ELITE	CEMBRIK 	902	62.25	54	566																			54	1.62	6.63
309	ELITE	REYON	902	45	42	566																			42	1.26	1.74
310	YAMUNAJI	CREPE 58"	204	1315.5	1289	574																			1289	38.67	-12.17
311	YAMUNAJI	CREPE 44"	204	1487.75	743.75	576																			743.75	22.3125	721.6875
312	YAMUNAJI	CREPE 58"	205	2586	1591.5	573	943	574																	2534.5	76.035	-24.535
313	FABTEX	CEMBRIK 	206	1753	1738	575																			1738	52.14	-37.14
314	YAMUNAJI	CREPE 58"	206	305.25	299	585																			299	8.97	-2.72
315	YAMUNAJI	CREPE 58"	208	1550.25	704.25	577	810	585																	1514.25	45.4275	-9.4275
316	YAMUNAJI	CEMBRIK 	208	50	16	578																			16	0.48	33.52
317	YAMUNAJI	CREPE 58"	207	2395	466.5	585	107.75	597	1549.5	599															2123.75	63.7125	207.5375
318	YAMUNAJI	REYON	207	98	97.25	579																			97.25	2.9175	-2.1675
319	ELITE	MAL 58"	907	2445.25	199.25	583	66.25	586	128	596	725.5	601	546.5	609	468.25	598	83.5	613							2217.25	66.5175	161.4825
320	AVSAR	CREPE 58"	212	993.75	975	577																			975	29.25	-10.5
321	ELITE	REYON	908	2198	528.5	584	569	587	533.25	593	436	589	11	611											2077.75	62.3325	57.9175
322	AVSAR	CREPE 58"	215	4353.75	1588	619	2117.5	620																	3705.5	111.165	537.085
323	ELITE	CREPE 58"	909	2207	622	590	1126.75	591	272.5	607															2021.25	60.6375	125.1125
324	ELITE	CEMBRIK 	915	204.5	106	RETURN	87	586																	193	5.79	5.71
325	FABTEX	CREPE 58"	209	1890.25	1352.25	604	500	605																	1852.25	55.5675	-17.5675
326	FABTEX	REYON	210	338	136.75	588	195	592																	331.75	9.9525	-3.7025
327	ELITE	CREPE 58"	920	2086.25	962	615	321	618																	1283	38.49	764.76
328	FABTEX	CREPE 58"	211	2688.5	1441.25	605	136.75	608																	1578	47.34	1063.16
329	FABTEX	REYON	219	148	106.5	592																			106.5	3.195	38.305
330	YAMUNAJI	CREPE 58"	212	981.5	610.5	610																			610.5	18.315	352.685
331	ELITE	CEMBRIK 	930	913.5	890	612																			890	26.7	-3.2
332	FABTEX	REYON	214	141.5	126	603																			126	3.78	11.72
333	ELITE	MAL 58"	938	2669.25	256.5	617																			256.5	7.695	2405.055
334	ELITE	CEMBRIK 	937	2368.5	312	612	219.75	613	710.5	616															1242.25		
335	FABTEX	REYON	215	243	232.75	614																			232.75		
336	FABTEX	SUMMER COOL	216	1980.25																					0		
337	ELITE	CREPE 58"	944	2484.25																					0		`;

const parseQualityAndPanna = (qlty) => {
  if (!qlty) return { fabricQuality: '', panna: '' };
  qlty = qlty.trim().toUpperCase();
  if (qlty === 'CEMBRIK' || qlty === 'CEMBRIC' || qlty === 'CAMRIK') qlty = 'CAMBRIC';
  if (qlty === 'CRAPE') qlty = 'CREPE';

  const match = qlty.match(/(.*)\s+(58["']?|36["']?|44["']?|48["']?|60["']?)$/i);
  if (match) {
    let fab = match[1].trim();
    if (fab === 'CEMBRIK' || fab === 'CEMBRIC' || fab === 'CAMRIK') fab = 'CAMBRIC';
    if (fab === 'CRAPE') fab = 'CREPE';
    const rawPanna = match[2].replace(/['"]/g, '');
    return {
      fabricQuality: fab,
      panna: rawPanna + '"'
    };
  }

  const defaultP = qlty.includes('ARMANI') ? '44"' : '58"';
  return { fabricQuality: qlty, panna: defaultP };
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  const FabricTransaction = require('../src/db/models/fabricTransaction.model');

  const lines = rawTable.trim().split('\n');
  console.log('Parsing', lines.length, 'ledger lines...');

  let lastLotNo = null;
  let parsedRows = [];

  for (const line of lines) {
    const parts = line.split('\t').map(s => s.trim());
    if (parts.length < 5) continue;

    let lotNo = parts[0] ? parseInt(parts[0], 10) : null;
    if (isNaN(lotNo)) lotNo = null;
    if (!lotNo && lastLotNo) {
      lotNo = lastLotNo;
    }
    if (lotNo) lastLotNo = lotNo;

    const vendor = parts[1] || 'ELITE';
    const qltyRaw = parts[2] || '';
    const challanNo = parts[3] || '';
    const mtr = parseFloat(parts[4]) || 0;

    if (!lotNo || !qltyRaw || mtr <= 0) continue;

    const { fabricQuality, panna } = parseQualityAndPanna(qltyRaw);

    const outwards = [];
    for (let i = 5; i < parts.length - 3; i += 2) {
      const outQty = parseFloat(parts[i]);
      const outJob = parts[i + 1] || '';
      if (!isNaN(outQty) && outQty > 0) {
        outwards.push({ qty: outQty, jobNo: outJob });
      }
    }

    parsedRows.push({
      lotNo,
      vendorName: vendor,
      partyName: vendor,
      fabricQuality,
      panna,
      challanNo,
      qty: mtr,
      outwards
    });
  }

  console.log('Successfully parsed', parsedRows.length, 'valid lot rows.');

  // Perform clean 100% exact import into database
  await FabricTransaction.deleteMany({});
  console.log('Cleared existing fabric transactions for clean 100% sync.');

  let syncedInward = 0;
  let syncedOutward = 0;

  for (const row of parsedRows) {
    const inTx = new FabricTransaction({
      type: 'INWARD',
      lotNo: row.lotNo,
      vendorName: row.vendorName,
      fabricQuality: row.fabricQuality,
      panna: row.panna,
      challanNo: row.challanNo,
      qty: row.qty,
      date: new Date('2026-06-15'),
      notes: 'Master Ledger Sync'
    });
    await inTx.save();
    syncedInward++;

    for (const out of row.outwards) {
      const outTx = new FabricTransaction({
        type: 'OUTWARD',
        lotNo: row.lotNo,
        partyName: row.partyName,
        fabricQuality: row.fabricQuality,
        panna: row.panna,
        qty: out.qty,
        jobNo: out.jobNo !== 'RETURN' ? out.jobNo : '',
        notes: out.jobNo === 'RETURN' ? 'RETURN' : 'Master Ledger Sync',
        date: new Date('2026-06-15')
      });
      await outTx.save();
      syncedOutward++;
    }
  }

  console.log('SUCCESS: 100% Exact Sync Complete!');
  console.log('Synced Inward:', syncedInward, '| Outward:', syncedOutward);

  const totalInMtr = await FabricTransaction.aggregate([
    { $match: { type: 'INWARD' } },
    { $group: { _id: null, total: { $sum: '$qty' } } }
  ]);

  const totalOutMtr = await FabricTransaction.aggregate([
    { $match: { type: 'OUTWARD' } },
    { $group: { _id: null, total: { $sum: '$qty' } } }
  ]);

  console.log('Total Inward Meters in DB:', totalInMtr[0]?.total || 0);
  console.log('Total Outward Meters in DB:', totalOutMtr[0]?.total || 0);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
