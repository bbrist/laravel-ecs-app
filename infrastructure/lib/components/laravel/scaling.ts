import {ScalableTaskCount} from "aws-cdk-lib/aws-ecs";
import {Duration} from "aws-cdk-lib";

export interface ScalingStrategy {
    apply(scaling: ScalableTaskCount): void;
}

export interface CpuScalingProps {
    targetUtilizationPercent?: number;
    scaleInCooldown?: Duration;
    scaleOutCooldown?: Duration;
}

export class CpuScalingStrategy implements ScalingStrategy {

    static readonly DEFAULT_TARGET_UTILIZATION_PERCENT = 80;
    static readonly DEFAULT_SCALE_IN_COOLDOWN_SECONDS = 60;
    static readonly DEFAULT_SCALE_OUT_COOLDOWN_SECONDS = 60;

    readonly props: CpuScalingProps;

    constructor(props: CpuScalingProps = {}) {
        this.props = props;
    }

    apply(scaling: ScalableTaskCount) {
        scaling.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: this.props.targetUtilizationPercent ?? CpuScalingStrategy.DEFAULT_TARGET_UTILIZATION_PERCENT,
            scaleInCooldown: this.props.scaleInCooldown ?? Duration.seconds(CpuScalingStrategy.DEFAULT_SCALE_IN_COOLDOWN_SECONDS),
            scaleOutCooldown: this.props.scaleOutCooldown ?? Duration.seconds(CpuScalingStrategy.DEFAULT_SCALE_IN_COOLDOWN_SECONDS),
        });
    }

    static utilization(targetUtilizationPercent: number, scaleInCooldown?: number|Duration, scaleOutCooldown?: number|Duration): CpuScalingStrategy {
        const scaleInCooldownDuration = scaleInCooldown instanceof Duration ?
            scaleInCooldown : Duration.seconds(scaleInCooldown ?? this.DEFAULT_SCALE_IN_COOLDOWN_SECONDS);
        const scaleOutCooldownDuration = scaleOutCooldown instanceof Duration ?
            scaleOutCooldown : Duration.seconds(scaleOutCooldown ?? this.DEFAULT_SCALE_OUT_COOLDOWN_SECONDS);
        return new CpuScalingStrategy({
            targetUtilizationPercent,
            scaleInCooldown: scaleInCooldownDuration,
            scaleOutCooldown: scaleOutCooldownDuration,
        });
    }

}