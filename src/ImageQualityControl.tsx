import { useId } from "react";
import { IMAGE_QUALITY_OPTIONS, type ImageQuality } from "./image-quality.mjs";
import "./image-quality.css";

export default function ImageQualityControl({ value, onChange, disabled = false }: {
  value: ImageQuality;
  onChange: (value: ImageQuality) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="image-quality-control" disabled={disabled} aria-describedby={id + "-hint"}>
      <legend>画面观感</legend>
      <div className="image-quality-options">
        {IMAGE_QUALITY_OPTIONS.map((option) => (
          <label className="image-quality-option" key={option.value}>
            <input type="radio" name={id} value={option.value} checked={value === option.value}
              onChange={() => onChange(option.value)} />
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
          </label>
        ))}
      </div>
      <p id={id + "-hint"}>只需描述想看到的画面。保留你指定的画风与昼夜，记住本次选择。</p>
    </fieldset>
  );
}
