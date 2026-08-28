const locations = [
    { name: "United Kingdom", coords: [-0.1276, 51.5074], flag: "https://flagcdn.com/w80/gb.png", offset: [-50, -50] },
    { name: "Czech Republic", coords: [14.4378, 50.0755], flag: "https://flagcdn.com/w80/cz.png", offset: [-20, -50] },
    { name: "Austria", coords: [16.3738, 48.2082], flag: "https://flagcdn.com/w80/at.png", offset: [50, -35] },
    { name: "Hungary", coords: [19.0402, 47.4979], flag: "https://flagcdn.com/w80/hu.png", offset: [70, 0] }
];

const container = d3.select("#map-container");
let width = container.node().getBoundingClientRect().width || 800;
let height = container.node().getBoundingClientRect().height || 600;

const svg = container.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

const projection = d3.geoMercator();
const path = d3.geoPath().projection(projection);

const targetNames = locations.map(d => d.name);
let worldData, countryFeatures, targetFeatures;

d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json").then(world => {
    worldData = world;
    // Normalize "Czechia" → "Czech Republic" to match our locations array
    countryFeatures = topojson.feature(world, world.objects.countries).features.map(d => {
        if (d.properties.name === "Czechia") d.properties.name = "Czech Republic";
        return d;
    });

    // Filter the specified countries
    targetFeatures = countryFeatures.filter(d =>
        targetNames.includes(d.properties.name)
    );

    // If no features found, use all countries as fallback to prevent map from disappearing
    if (targetFeatures.length === 0) {
        targetFeatures = countryFeatures;
    }

    updateMap();
});

function updateMap() {
    if (!countryFeatures) return;

    width = container.node().getBoundingClientRect().width;
    height = container.node().getBoundingClientRect().height;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Fit projection to the target countries shifted to the right for balance
    const paddingTop = 50;
    const paddingBottom = 50;
    const paddingLeft = 300; // Shift right to balance with sidebar
    const paddingRight = 50;

    projection.fitExtent([[paddingLeft, paddingTop], [width - paddingRight, height - paddingBottom]], {
        type: "FeatureCollection",
        features: targetFeatures
    });

    const triggerHover = (countryName, active, event) => {
        const safeName = countryName.replace(/\s+/g, '-');
        const location = locations.find(l => l.name === countryName);

        // Toggle class on path and marker
        svg.selectAll(`.country-${safeName}`).classed("is-hovered", active);
        svg.selectAll(`.marker-${safeName}`).classed("is-hovered", active);

        // Handle tooltip
        if (active && location) {
            const coords = projection(location.coords);
            const containerRect = container.node().getBoundingClientRect();

            // Calculate tooltip position relative to the page
            // We use the marker's coordinate in the SVG + the container's position
            const x = containerRect.left + coords[0] + location.offset[0];
            const y = containerRect.top + coords[1] + location.offset[1];

            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(countryName)
                .style("left", x + "px")
                .style("top", y + "px");
        } else {
            tooltip.transition().duration(500).style("opacity", 0);
        }
    };

    const navigateToCountry = (countryName) => {
        const urls = {
            "United Kingdom": "uk.html",
            "Czech Republic": "czechRepublic.html",
            "Austria": "austria.html",
            "Hungary": "hungary.html"
        };
        if (urls[countryName]) {
            window.location.href = urls[countryName];
        }
    };

    // Draw/Update countries
    let countryPaths = svg.selectAll(".country").data(countryFeatures);

    countryPaths.enter()
        .append("path")
        .merge(countryPaths)
        .attr("class", d => {
            const name = d.properties.name;
            const isTarget = targetNames.includes(name);
            const safeName = name.replace(/\s+/g, '-');
            return `country ${isTarget ? "target-country country-" + safeName : "other-country"}`;
        })
        .attr("d", path)
        .on("mouseover", (event, d) => {
            const name = d.properties.name;
            if (targetNames.includes(name)) triggerHover(name, true, event);
        })
        .on("mouseout", (event, d) => {
            const name = d.properties.name;
            if (targetNames.includes(name)) triggerHover(name, false, event);
        })
        .on("click", (event, d) => {
            const name = d.properties.name;
            if (targetNames.includes(name)) navigateToCountry(name);
        });

    // Draw/Update markers
    let markers = svg.selectAll(".markers").data([null]);
    const markersGroup = markers.enter().append("g").attr("class", "markers").merge(markers);

    let markerGroups = markersGroup.selectAll(".marker-group").data(locations);

    const markerGroupsEnter = markerGroups.enter()
        .append("g")
        .attr("class", d => `marker-group marker-${d.name.replace(/\s+/g, '-')}`)
        .on("mouseover", (event, d) => triggerHover(d.name, true, event))
        .on("mouseout", (event, d) => triggerHover(d.name, false, event))
        .on("click", (event, d) => navigateToCountry(d.name));

    // Add a defs section for clipPaths
    const defs = svg.append("defs");

    markerGroupsEnter.each(function (d) {
        const safeName = d.name.replace(/\s+/g, '-');
        // Create unique clipPath per marker
        const clip = defs.append("clipPath")
            .attr("id", `flag-clip-${safeName}`);
        clip.append("circle")
            .attr("cx", 0)
            .attr("cy", -20)
            .attr("r", 11);
    });

    // Map pin teardrop shape: circle on top, pointed bottom (scaled to ~70%)
    markerGroupsEnter.append("path")
        .attr("class", "marker-pin")
        .attr("d", "M0,0 C-3,-6 -14,-10 -14,-20 C-14,-29 -7,-35 0,-35 C7,-35 14,-29 14,-20 C14,-10 3,-6 0,0 Z");

    markerGroupsEnter.append("image")
        .attr("class", "marker-flag")
        .attr("href", d => d.flag)
        .attr("x", -11)
        .attr("y", -31)
        .attr("width", 22)
        .attr("height", 22)
        .attr("preserveAspectRatio", "xMidYMid slice")
        .attr("clip-path", d => `url(#flag-clip-${d.name.replace(/\s+/g, '-')})`);

    markerGroups.merge(markerGroupsEnter)
        .attr("transform", d => {
            const coords = projection(d.coords);
            if (!coords) return "translate(0,0)";
            return `translate(${coords[0]},${coords[1]})`;
        });
}

window.addEventListener('resize', updateMap);
