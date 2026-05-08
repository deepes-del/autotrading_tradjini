
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from 'recharts';

interface ChartProps {
  type: 'pie' | 'bar' | 'line';
  data: any[];
  colors?: string[];
  size?: 'sm' | 'md' | 'lg';
}

const Chart = ({ type, data, colors = ['#2563eb', '#8b5cf6', '#ec4899', '#f59e0b'], size = 'md' }: ChartProps) => {
  const getSize = () => {
    switch (size) {
      case 'sm': return { width: 150, height: 150 };
      case 'md': return { width: 200, height: 200 };
      case 'lg': return { width: 300, height: 250 };
      default: return { width: 200, height: 200 };
    }
  };

  const { width, height } = getSize();

  if (type === 'pie') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size === 'sm' ? 30 : 50}
            outerRadius={size === 'sm' ? 60 : 80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={false} />
          <YAxis tick={false} />
          <Bar dataKey="value" fill={colors[0]} radius={4} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={data}>
          <XAxis dataKey="name" tick={false} />
          <YAxis tick={false} />
          <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return null;
};

export default Chart;
