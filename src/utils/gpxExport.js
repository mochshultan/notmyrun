export function generateGPXString({
  trackPoints,
  runName,
  description = "",
  startTime,
  isBike,
  includeHr,
  includeCadence
}) {
  const typeCode = isBike ? "2" : "1"; // Strava strict types: 1=run, 2=bike
  const safeName = (runName || "Activity").replace(/[<>&'"]/g, '');
  const safeDesc = description.replace(/[<>&'"]/g, '');
  const startIso = new Date(startTime).toISOString();

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
  creator="NotMyRun"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"
  xsi:schemaLocation="
    http://www.topografix.com/GPX/1/1
    http://www.topografix.com/GPX/1/1/gpx.xsd
    http://www.garmin.com/xmlschemas/GpxExtensions/v3
    http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd
    http://www.garmin.com/xmlschemas/TrackPointExtension/v1
    http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">
  <metadata>
    <name>${safeName}</name>
    <time>${startIso}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <desc>${safeDesc}</desc>
    <type>${typeCode}</type>
    <trkseg>
`;

  for (let i = 0; i < trackPoints.length; i++) {
    const pt = trackPoints[i];
    gpx += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">
        <ele>${pt.elevation.toFixed(1)}</ele>
        <time>${pt.timeStr}</time>
`;

    if (includeHr || includeCadence) {
      gpx += `        <extensions>
          <gpxtpx:TrackPointExtension>
`;
      // Optional atemp (ambient temp) - hardcode to 20 for realism
      gpx += `            <gpxtpx:atemp>20</gpxtpx:atemp>\n`;

      if (includeHr && pt.hr) {
        gpx += `            <gpxtpx:hr>${pt.hr}</gpxtpx:hr>\n`;
      }
      if (includeCadence && pt.cadence) {
        gpx += `            <gpxtpx:cad>${pt.cadence}</gpxtpx:cad>\n`;
      }
      gpx += `          </gpxtpx:TrackPointExtension>
        </extensions>
`;
    }
    
    gpx += `      </trkpt>\n`;
  }

  gpx += `    </trkseg>
  </trk>
</gpx>`;

  return gpx;
}
