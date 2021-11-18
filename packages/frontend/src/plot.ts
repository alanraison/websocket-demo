import { Selection } from "d3-selection";
import { scaleLinear } from "d3-scale";
import "d3-transition";

export interface PersonData {
  name: string;
  id: string;
}

interface PersonDataWithCoords extends PersonData {
  x: number;
  y: number;
}

export function update<S extends SVGElement, T, V>(
  plot: Selection<S, T, HTMLElement, V>
) {
  const boxWidth = 200;
  const boxHeight = 30;

  const rangeX = 16 ** 5;
  const rangeY = 16 ** 5;

  const svgNode = document.getElementById("d3");
  const clientHeight = svgNode?.clientHeight || 100;
  const clientWidth = svgNode?.clientWidth || 100;
  const x = scaleLinear()
    .domain([0, rangeX])
    .rangeRound([0, clientWidth - boxWidth]);
  const y = scaleLinear()
    .domain([0, rangeY])
    .rangeRound([0, clientHeight - boxHeight]);

  return function updatePlot(data: Array<PersonData>) {
    const dataWithCoords = data.map((person) => ({
      ...person,
      x: x(parseInt(person.id.substring(5, 10), 16)) || 0,
      y: y(parseInt(person.id.substring(15, 20), 16)) || 0,
    }));

    const nodes = plot
      .selectAll(".person")
      .data(dataWithCoords, (d) => (d as PersonDataWithCoords).id)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .classed("person", true)
            .attr("transform", (d) => `translate(${d.x} ${d.y})`);
          g.append("rect")
            .attr("width", boxWidth)
            .attr("height", boxHeight)
            .attr("fill", "green")
            .attr("stroke", "black")
            .transition()
            .duration(500)
            .attr("fill", "white");
          g.append("text")
            .attr("x", 10)
            .attr("y", 20)
            .text((d) => d.name);
          return g;
        },
        (update) => update,
        (exit) => {
          exit.select("rect").attr("fill", "red");
          exit
            .attr("fill-opacity", 1)
            .attr("stroke-opacity", 1)
            .transition()
            .duration(500)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0)
            .remove();
          return exit;
        }
      );
  };
}
